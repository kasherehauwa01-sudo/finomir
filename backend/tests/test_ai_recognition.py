import json
from pathlib import Path
from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.models.entities import AISettings
from app.services.ai_recognition import AIInvoiceRecognitionService, _error_details, assess_required
from app.services.ai_settings import decrypt_api_key, encrypt_api_key, public_ai_settings


def primary(**overrides):
    result={"partner":{"id":"p","value":"Партнер"},"counterparty":{"id":"c","value":"ООО Ромашка"},"service_name":{"value":"Реклама"},"invoice_number":{"value":"125"},"invoice_date":{"value":"2026-08-27"},"amount":{"value":"100.00"}}
    result.update(overrides); return result


class FakeDB:
    def __init__(self, settings, cached=None, directories=()): self.settings=settings; self.cached=cached; self.directories=list(directories); self.added=[]
    def get(self, model, item_id): return self.settings if model is AISettings else None
    def scalar(self, query): return self.cached
    def scalars(self, query): return SimpleNamespace(all=lambda:self.directories)
    def add(self, item): self.added.append(item)
    def flush(self): pass


class FakeResponses:
    def __init__(self, payload=None, error=None): self.payload=payload; self.error=error; self.calls=0
    def create(self, **kwargs):
        self.calls+=1
        if self.error: raise self.error
        return SimpleNamespace(output_text=json.dumps(self.payload),_request_id="req_test",usage=SimpleNamespace(model_dump=lambda:{"input_tokens":10,"output_tokens":5}))


def settings(): return SimpleNamespace(enabled=True,encrypted_api_key="encrypted",model="gpt-4.1-mini")
def document(tmp_path:Path):
    path=tmp_path/"invoice.png"; path.write_bytes(b"image")
    return SimpleNamespace(id=uuid4(),storage_path=str(path),mime_type="image/png",original_filename="invoice.png")


def ai_payload(amount=100.0, invoice_date="2026-08-27"):
    text=lambda value:{"value":value,"confidence":.95}
    return {"partner":text("Неизвестный"),"counterparty":{"value":"ООО Ромашка","inn":"7707083893","confidence":.95},"service_name":text("Реклама"),"invoice_number":text("125"),"invoice_date":text(invoice_date),"amount":{"value":amount,"currency":"RUB","confidence":.98}}


def test_primary_six_of_six_does_not_call_openai(tmp_path,monkeypatch):
    responses=FakeResponses(ai_payload()); service=AIInvoiceRecognitionService(lambda **kwargs:SimpleNamespace(responses=responses)); db=FakeDB(settings())
    result,log=service.supplement(db,document(tmp_path),primary())
    assert result==primary() and log is None and responses.calls==0


def test_primary_five_of_six_calls_openai_and_supplements_amount(tmp_path,monkeypatch):
    monkeypatch.setattr("app.services.ai_recognition.decrypt_api_key",lambda value:"sk-test")
    responses=FakeResponses(ai_payload()); service=AIInvoiceRecognitionService(lambda **kwargs:SimpleNamespace(responses=responses)); db=FakeDB(settings())
    result,log=service.supplement(db,document(tmp_path),primary(amount={"value":None}))
    assert responses.calls==1 and result["amount"]["value"]=="100.00" and result["amount"]["source"]=="ai" and log.supplemented_fields==["amount"]


def test_ai_null_keeps_primary_result_for_manual_completion(tmp_path,monkeypatch):
    monkeypatch.setattr("app.services.ai_recognition.decrypt_api_key",lambda value:"sk-test"); payload=ai_payload(None)
    result,log=AIInvoiceRecognitionService(lambda **kwargs:SimpleNamespace(responses=FakeResponses(payload))).supplement(FakeDB(settings()),document(tmp_path),primary(amount={"value":None}))
    assert result["amount"]["value"] is None and not log.success


@pytest.mark.parametrize("status,text,code",[(401,"unauthorized","invalid_api_key"),(429,"insufficient_quota","insufficient_quota"),(429,"rate limit","rate_limit"),(503,"down","service_unavailable")])
def test_openai_errors_are_mapped_without_secrets(status,text,code):
    error=RuntimeError(text); error.status_code=status
    assert _error_details(error)[0]==code and "sk-" not in _error_details(error)[1]


def test_openai_failure_does_not_break_finomir(tmp_path,monkeypatch):
    monkeypatch.setattr("app.services.ai_recognition.decrypt_api_key",lambda value:"sk-test"); error=RuntimeError("network"); responses=FakeResponses(error=error)
    result,log=AIInvoiceRecognitionService(lambda **kwargs:SimpleNamespace(responses=responses)).supplement(FakeDB(settings()),document(tmp_path),primary(amount={"value":None}))
    assert result["amount"]["value"] is None and log.error_code=="connection_error"


def test_unknown_ai_partner_is_only_a_suggestion(tmp_path,monkeypatch):
    monkeypatch.setattr("app.services.ai_recognition.decrypt_api_key",lambda value:"sk-test"); db=FakeDB(settings())
    result,log=AIInvoiceRecognitionService(lambda **kwargs:SimpleNamespace(responses=FakeResponses(ai_payload()))).supplement(db,document(tmp_path),primary(partner={"id":None,"value":None}))
    assert result["partner"]["id"] is None and result["partner"]["value"]=="Неизвестный" and db.added==[log]


@pytest.mark.parametrize(("field","value"),[("invoice_date","27.08.2026"),("amount","-10"),("invoice_number","ОПЛАТА")])
def test_invalid_ai_values_are_rejected(field,value,tmp_path,monkeypatch):
    monkeypatch.setattr("app.services.ai_recognition.decrypt_api_key",lambda value:"sk-test"); payload=ai_payload()
    payload[field]["value"]=value; initial=primary(**{field:{"value":None}})
    result,_=AIInvoiceRecognitionService(lambda **kwargs:SimpleNamespace(responses=FakeResponses(payload))).supplement(FakeDB(settings()),document(tmp_path),initial)
    assert result[field]["value"] is None


def test_repeated_document_uses_cached_result_without_paid_request(tmp_path):
    cached=SimpleNamespace(final_fields=primary(),model="gpt-4.1-mini"); responses=FakeResponses(ai_payload())
    result,log=AIInvoiceRecognitionService(lambda **kwargs:SimpleNamespace(responses=responses)).supplement(FakeDB(settings(),cached=cached),document(tmp_path),primary(amount={"value":None}))
    assert result==cached.final_fields and log is cached and responses.calls==0


def test_required_field_validation_rejects_bad_formats():
    assert set(assess_required(primary(invoice_number={"value":"слово"},invoice_date={"value":"27.08.2026"},amount={"value":"0"})))=={"invoice_number","invoice_date","amount"}


def test_api_key_is_encrypted_and_never_returned(monkeypatch):
    monkeypatch.setattr("app.services.ai_settings.get_settings",lambda:SimpleNamespace(ai_settings_encryption_key="server-only-secret"))
    encrypted=encrypt_api_key("sk-private-value")
    item=SimpleNamespace(enabled=True,model="gpt-4.1-mini",encrypted_api_key=encrypted,connection_status="not_checked",connection_error=None,checked_at=None)
    assert "sk-private-value" not in encrypted and decrypt_api_key(encrypted)=="sk-private-value"
    assert "api_key" not in public_ai_settings(item) and public_ai_settings(item)["api_key_saved"]
