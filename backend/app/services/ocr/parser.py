import re
from datetime import date
from decimal import Decimal, InvalidOperation

from .base import OCRResult

MONTHS = {name: i + 1 for i, name in enumerate("января февраля марта апреля мая июня июля августа сентября октября ноября декабря".split())}


def validate_inn(value: str) -> bool:
    """Проверяет контрольные цифры российского ИНН."""
    if not value.isdigit() or len(value) not in (10, 12): return False
    digits = [int(x) for x in value]
    check = lambda weights: sum(a * b for a, b in zip(digits, weights)) % 11 % 10
    if len(value) == 10: return check([2, 4, 10, 3, 5, 9, 4, 6, 8]) == digits[9]
    return check([7, 2, 4, 10, 3, 5, 9, 4, 6, 8]) == digits[10] and check([3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8]) == digits[11]


def _date(value: str) -> str | None:
    value = value.strip().lower().replace(" г.", "").replace(" г", "")
    match = re.search(r"(\d{1,2})[.\-/\s]+([а-яё]+|\d{1,2})[.\-/\s]+(\d{2,4})", value)
    if not match: return None
    month = MONTHS.get(match.group(2), int(match.group(2)) if match.group(2).isdigit() else 0)
    year = int(match.group(3)); year += 2000 if year < 100 else 0
    try: return date(year, month, int(match.group(1))).isoformat()
    except ValueError: return None


def _money(value: str) -> Decimal | None:
    compact = re.sub(r"[\s₽]", "", value).replace("руб.", "").replace("руб", "")
    if "," in compact: compact = compact.replace(".", "").replace(",", ".")
    try: return Decimal(compact).quantize(Decimal("0.01"))
    except InvalidOperation: return None


class RussianInvoiceParser:
    """Детерминированный парсер российских счетов, независимый от OCR-движка."""
    def parse(self, text: str, ocr_confidence: float = 1.0, blocks: list | None = None) -> OCRResult:
        normalized = text.replace("\xa0", " "); lines = [re.sub(r"\s+", " ", x).strip() for x in normalized.splitlines() if x.strip()]
        header = re.search(r"сч[её]т(?:\s+на\s+оплату)?\s*(?:№|N)?\s*([А-ЯA-Z0-9][А-ЯA-Z0-9\-/]*)", normalized, re.I)
        number = header.group(1).strip() if header else None
        date_value = None
        if header:
            date_value = _date(normalized[header.end():header.end() + 80])
        if not date_value:
            date_value = _date(normalized)
        amount = None; amount_score = 0.0
        for label, score in (("всего к оплате", .98), ("итого к оплате", .95), ("сумма счета", .9), ("итого", .78), ("всего", .7)):
            matches = re.findall(label + r"[ \t]*[:\-]?[ \t]*([\d][\d \t]*(?:[,.]\d{1,2})?[ \t]*(?:руб\.?|₽)?)", normalized, re.I)
            if matches:
                candidate = _money(matches[-1])
                if candidate is not None: amount, amount_score = candidate, score; break
        inn = None; inn_valid = False
        for raw in re.findall(r"инн(?:\s*/\s*кпп)?\s*[:№]?\s*([0-9OОIІl\s-]{10,18})", normalized, re.I):
            candidate = re.sub(r"\D", "", raw.translate(str.maketrans({"O":"0","О":"0","I":"1","І":"1","l":"1"})))
            if len(candidate) in (10, 12):
                if validate_inn(candidate): inn, inn_valid = candidate, True; break
                if inn is None: inn = candidate
        recipient = None; recipient_score = 0.0
        organization = r"((?:ООО|АО|ПАО)\s*[«\"']?[^\n,;]+[»\"']?|ИП\s+[А-ЯЁA-Z][^\n,;]+)"
        for label, score in (("поставщик", .92), ("исполнитель", .9), ("получатель", .78)):
            found = re.search(label + r"\s*(?:\([^)]*\))?\s*[:\-]?\s*" + organization, normalized, re.I)
            if found: recipient, recipient_score = found.group(1).strip(" :"), score; break
        if not recipient:
            found = re.search(organization, normalized, re.I)
            if found: recipient, recipient_score = found.group(1).strip(), .65
        scale = max(.3, min(1.0, ocr_confidence))
        return OCRResult(invoice_number=number, invoice_date=date_value, invoice_amount=amount,
            counterparty_name=recipient, inn=inn, raw_text=text, blocks=blocks or [],
            confidence={"invoice_number": (.94 if number else 0) * scale, "invoice_date": (.92 if date_value else 0) * scale,
             "invoice_amount": amount_score * scale, "counterparty_name": recipient_score * scale,
             "inn": ((.99 if inn_valid else .45) if inn else 0) * scale})
