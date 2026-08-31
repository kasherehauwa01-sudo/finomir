import base64
import json
import logging
import re
import time
from datetime import date, datetime, timezone
from decimal import Decimal, InvalidOperation
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models.entities import AIFallbackLog, Counterparty, Document, Partner
from app.services.ai_settings import decrypt_api_key, get_ai_settings

logger = logging.getLogger(__name__)
REQUIRED_FIELDS = ("partner", "counterparty", "service_name", "invoice_number", "invoice_date", "amount")
INVOICE_RECOGNITION_PROMPT = """Ты распознаёшь российский счёт на оплату и возвращаешь только поля заданной JSON-схемы.

Правила заполнения:
- counterparty — поставщик/исполнитель, которому оплачивают счёт, а не покупатель/заказчик и не банк. Возьми полное наименование из блока «Поставщик (Исполнитель)»; если этот блок не читается — из реквизитов «Получатель». ИНН также бери только у поставщика/получателя. Сохраняй организационно-правовую форму и название, например: ООО «АПРЕС».
- service_name — точное наименование товара, работы или услуги из колонки «Товары (работы, услуги)» первой строки табличной части. Не включай номер строки, количество, единицу измерения, цену и сумму. Если строк несколько, объедини их наименования через «; ».
- invoice_number и invoice_date — номер и дата из заголовка «Счёт на оплату», amount — итог «Всего к оплате», partner — только явно указанный в документе партнёр.
- Не путай подписи полей и заголовки колонок со значениями. Не исправляй и не сокращай распознанный текст по смыслу.
- Ничего не выдумывай: если значение нельзя надёжно прочитать или его нет в документе, верни null. Дата только YYYY-MM-DD, сумма — положительное число в RUB.
"""
SCHEMA = {"type":"object","additionalProperties":False,"properties":{
    "partner":{"$ref":"#/$defs/text"},"counterparty":{"type":"object","additionalProperties":False,"properties":{"value":{"type":["string","null"]},"inn":{"type":["string","null"]},"confidence":{"type":"number","minimum":0,"maximum":1}},"required":["value","inn","confidence"]},
    "service_name":{"$ref":"#/$defs/text"},"invoice_number":{"$ref":"#/$defs/text"},"invoice_date":{"$ref":"#/$defs/text"},
    "amount":{"type":"object","additionalProperties":False,"properties":{"value":{"type":["number","null"]},"currency":{"type":["string","null"]},"confidence":{"type":"number","minimum":0,"maximum":1}},"required":["value","currency","confidence"]}},
    "required":["partner","counterparty","service_name","invoice_number","invoice_date","amount"],"$defs":{"text":{"type":"object","additionalProperties":False,"properties":{"value":{"type":["string","null"]},"confidence":{"type":"number","minimum":0,"maximum":1}},"required":["value","confidence"]}}}


def _valid_date(value) -> str | None:
    try: return date.fromisoformat(str(value)).isoformat()
    except (TypeError, ValueError): return None


def _valid_amount(value) -> str | None:
    try:
        number=Decimal(str(value)); return str(number.quantize(Decimal("0.01"))) if number > 0 else None
    except (InvalidOperation, TypeError, ValueError): return None


def _valid_number(value) -> str | None:
    value=str(value or "").strip()
    return value if value and len(value)<=100 and re.fullmatch(r"[0-9A-Za-zА-Яа-яЁё/\-]+",value) and any(x.isdigit() for x in value) else None


def assess_required(fields: dict) -> list[str]:
    missing=[]
    if not fields.get("partner",{}).get("id"): missing.append("partner")
    if not fields.get("counterparty",{}).get("id"): missing.append("counterparty")
    if not str(fields.get("service_name",{}).get("value") or "").strip(): missing.append("service_name")
    if not _valid_number(fields.get("invoice_number",{}).get("value")): missing.append("invoice_number")
    if not _valid_date(fields.get("invoice_date",{}).get("value")): missing.append("invoice_date")
    if not _valid_amount(fields.get("amount",{}).get("value")): missing.append("amount")
    return missing


def _normalize(value: str | None) -> str: return "".join(x for x in (value or "").casefold() if x.isalnum())
def _digits(value: str | None) -> str: return "".join(x for x in (value or "") if x.isdigit())


def match_directories(db: Session, ai: dict) -> tuple[Partner|None, Counterparty|None]:
    counterparties=db.scalars(select(Counterparty).where(Counterparty.deleted_at.is_(None))).all()
    cp=ai.get("counterparty",{}); inn=_digits(cp.get("inn")); name=_normalize(cp.get("value"))
    matches=[x for x in counterparties if inn and _digits(x.inn)==inn]
    if len(matches)!=1 and name: matches=[x for x in counterparties if _normalize(x.full_name)==name or _normalize(x.short_name)==name]
    counterparty=matches[0] if len(matches)==1 else None
    if counterparty and counterparty.partner_id: return db.get(Partner,counterparty.partner_id),counterparty
    partner_name=_normalize(ai.get("partner",{}).get("value")); partners=db.scalars(select(Partner).where(Partner.deleted_at.is_(None))).all()
    partner_matches=[x for x in partners if partner_name and _normalize(x.name)==partner_name]
    return (partner_matches[0] if len(partner_matches)==1 else None),counterparty


def _document_content(document: Document) -> dict:
    encoded=base64.b64encode(Path(document.storage_path).read_bytes()).decode()
    if document.mime_type=="application/pdf": return {"type":"input_file","filename":document.original_filename,"file_data":f"data:application/pdf;base64,{encoded}"}
    return {"type":"input_image","image_url":f"data:{document.mime_type};base64,{encoded}"}


def _error_details(error: Exception) -> tuple[str,str]:
    status=getattr(error,"status_code",None); text=str(error).lower()
    if status==401: return "invalid_api_key","Неверный API-ключ"
    if status==429 and ("quota" in text or "billing" in text): return "insufficient_quota","Недостаточно средств или исчерпан лимит"
    if status==429: return "rate_limit","Превышен лимит запросов"
    if status and status>=500: return "service_unavailable","Сервис OpenAI временно недоступен"
    return "connection_error","Ошибка подключения к OpenAI"


class AIInvoiceRecognitionService:
    def __init__(self, client_factory=None): self.client_factory=client_factory

    def _client(self, **kwargs):
        if self.client_factory: return self.client_factory(**kwargs)
        from openai import OpenAI
        return OpenAI(**kwargs)

    def test_connection(self, api_key: str, model: str) -> None:
        client=self._client(api_key=api_key,timeout=get_settings().openai_timeout_seconds,max_retries=0)
        client.responses.create(model=model,input="Ответь одним словом: OK",max_output_tokens=8)

    def supplement(self, db:Session, document:Document, primary:dict) -> tuple[dict,AIFallbackLog|None]:
        missing=assess_required(primary); settings=get_ai_settings(db)
        logger.info("Required invoice fields for document %s: %s/6; missing=%s",document.id,6-len(missing),",".join(missing) or "none")
        if not missing or not settings.enabled or not settings.encrypted_api_key: return primary,None
        logger.info("AI fallback required for document %s using model %s",document.id,settings.model)
        cached=db.scalar(select(AIFallbackLog).where(AIFallbackLog.document_id==document.id,AIFallbackLog.model==settings.model).order_by(AIFallbackLog.created_at.desc()))
        if cached: return cached.final_fields,cached
        started=time.monotonic(); now=datetime.now(timezone.utc); ai={}; request_id=None; usage=None; error_code=error_message=None
        try:
            client=self._client(api_key=decrypt_api_key(settings.encrypted_api_key),timeout=get_settings().openai_timeout_seconds,max_retries=0)
            response=client.responses.create(model=settings.model,input=[{"role":"system","content":[{"type":"input_text","text":INVOICE_RECOGNITION_PROMPT}]},{"role":"user","content":[{"type":"input_text","text":f"Основной механизм не заполнил: {', '.join(missing)}. Проанализируй исходный документ."},_document_content(document)]}],text={"format":{"type":"json_schema","name":"invoice_fields","strict":True,"schema":SCHEMA}})
            ai=json.loads(response.output_text); request_id=getattr(response,"_request_id",None); raw_usage=getattr(response,"usage",None); usage=raw_usage.model_dump() if hasattr(raw_usage,"model_dump") else None
            logger.info("OpenAI response received for document %s",document.id)
        except Exception as error:
            error_code,error_message=_error_details(error); logger.warning("OpenAI fallback failed for document %s: %s",document.id,error_code)
        partner,counterparty=match_directories(db,ai) if ai else (None,None); merged=json.loads(json.dumps(primary,default=str)); supplemented=[]
        candidates={"partner":{"id":str(partner.id) if partner else None,"value":partner.name if partner else ai.get("partner",{}).get("value"),"matched":bool(partner),"confidence":ai.get("partner",{}).get("confidence",0)},"counterparty":{"id":str(counterparty.id) if counterparty else None,"value":counterparty.full_name if counterparty else ai.get("counterparty",{}).get("value"),"inn":ai.get("counterparty",{}).get("inn"),"matched":bool(counterparty),"confidence":ai.get("counterparty",{}).get("confidence",0)},"service_name":ai.get("service_name",{}),"invoice_number":ai.get("invoice_number",{}),"invoice_date":ai.get("invoice_date",{}),"amount":ai.get("amount",{})}
        validators={"invoice_number":_valid_number,"invoice_date":_valid_date,"amount":_valid_amount}
        for key in missing:
            candidate=candidates[key]; valid=(candidate.get("id") if key in ("partner","counterparty") else validators.get(key,lambda x:str(x or "").strip() or None)(candidate.get("value")))
            if key in ("partner","counterparty") and candidate.get("value") and float(candidate.get("confidence",0))>=.5:
                candidate["source"]="ai"; merged[key]=candidate
            if valid and float(candidate.get("confidence",0))>=.5:
                candidate["value"]=valid if key not in ("partner","counterparty") else candidate.get("value"); candidate["source"]="ai"; merged[key]=candidate; supplemented.append(key)
        duration=int((time.monotonic()-started)*1000); final_missing=assess_required(merged)
        log=AIFallbackLog(document_id=document.id,missing_fields=missing,reason="Не заполнены или не сопоставлены обязательные поля: "+", ".join(missing),model=settings.model,success=not final_missing,primary_fields=primary,ai_fields=candidates if ai else {},final_fields=merged,supplemented_fields=supplemented,duration_ms=duration,error_code=error_code,error_message=error_message,usage=usage,request_id=request_id,status="new",created_at=now,updated_at=now)
        logger.info("AI fallback completed for document %s: supplemented=%s final=%s/6",document.id,",".join(supplemented) or "none",6-len(final_missing))
        db.add(log); db.flush(); return merged,log
