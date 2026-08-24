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
    kop = re.search(r"(\d[\d ]*)\s*руб\.?\s*(\d{1,2})\s*коп", value, re.I)
    if kop: value = f"{kop.group(1)},{kop.group(2)}"
    compact = re.sub(r"[\s₽]", "", value).replace("руб.", "").replace("руб", "")
    if "," in compact: compact = compact.replace(".", "").replace(",", ".")
    try: return Decimal(compact).quantize(Decimal("0.01"))
    except InvalidOperation: return None


class RussianInvoiceParser:
    """Детерминированный парсер российских счетов, независимый от OCR-движка."""
    def parse(self, text: str, ocr_confidence: float = 1.0, blocks: list | None = None) -> OCRResult:
        normalized = text.replace("\xa0", " ")
        title = r"[сc][ч4][еёe]т"
        marker = r"(?:№|N(?:o|[º°])?)"
        number_pattern = r"([А-ЯЁA-Z0-9]+(?:[-/][А-ЯЁA-Z0-9]+)*)"
        # Специфичный заголовок проверяется первым. Маркер номера обязателен,
        # а наличие цифры не позволяет принять часть обычного слова за номер.
        header = re.search(title + r"\s+на\s+оплат[уy]\s*" + marker + r"\s*" + number_pattern, normalized, re.I)
        header_score = .98
        if not header:
            header = re.search(title + r"\s*" + marker + r"\s*" + number_pattern, normalized, re.I)
            header_score = .91
        number = header.group(1).strip() if header and re.search(r"\d", header.group(1)) and len(header.group(1)) <= 64 else None
        date_value = None
        if header:
            date_value = _date(normalized[header.end():header.end() + 80])
        if not date_value:
            date_value = _date(normalized)
        amount = None; amount_score = 0.0
        for label, score in ((r"всего\s+к\s+оплате", .98), (r"итого\s+к\s+оплате", .95), (r"к\s+оплате", .9), (r"сумма\s+сч[её]та", .88), ("итого", .76), (r"всего(?!\s+наименований)", .68)):
            matches = re.findall(label + r"[ \t]*[:\-]?[ \t\r\n]*([\d][\d \t]*(?:[,.]\d{1,2})?(?:[ \t]*руб\.?[ \t]*(?:\d{1,2}[ \t]*коп\.?)?|[ \t]*₽)?)", normalized, re.I)
            if matches:
                candidate = _money(matches[-1])
                if candidate is not None: amount, amount_score = candidate, score; break
        if amount is None:
            fallback = re.findall(r"на\s+сумму\s+([\d][\d \t]*(?:[,.]\d{1,2})?)[ \t]*руб", normalized, re.I)
            if fallback: amount, amount_score = _money(fallback[-1]), .62
        inn = None; inn_valid = False; kpp = None
        inn_sources = []
        for start, end in ((r"(?:поставщик|исполнитель)", r"(?:покупатель|заказчик)"), (r"получатель", r"(?:покупатель|заказчик|сч[её]т\s+на\s+оплату)")):
            context = re.search(start + r"[\s\S]{0,500}?(?=" + end + r"|$)", normalized, re.I)
            if context: inn_sources.append(context.group(0))
        inn_sources.append(re.sub(r"(?:покупатель|заказчик)[\s\S]*", "", normalized, flags=re.I))
        for raw in (item for source in inn_sources for item in re.findall(r"инн(?:\s*/\s*кпп)?\s*[:№]?\s*([0-9OОIІl\s-]{10,18})", source, re.I)):
            candidate = re.sub(r"\D", "", raw.translate(str.maketrans({"O":"0","О":"0","I":"1","І":"1","l":"1"})))
            if len(candidate) in (10, 12):
                if validate_inn(candidate): inn, inn_valid = candidate, True; break
                if inn is None: inn = candidate
        for source in inn_sources:
            kpp_match = re.search(r"кпп\s*[:№]?\s*(\d{9})", source, re.I)
            if kpp_match: kpp = kpp_match.group(1); break
        recipient = None; recipient_score = 0.0
        organization = r"((?:ООО|АО|ПАО|ЗАО)\s*[«\"']?[^\n,;]+[»\"']?|ИП\s+[А-ЯЁA-Z][^\n,;]+)"
        for label, score in (("поставщик", .92), ("исполнитель", .9), ("получатель", .78)):
            found = re.search(label + r"\s*(?:\([^)]*\))?\s*[:\-]?\s*" + organization, normalized, re.I)
            if found: recipient, recipient_score = found.group(1).strip(" :"), score; break
        if not recipient:
            found = re.search(organization, normalized, re.I)
            if found: recipient, recipient_score = found.group(1).strip(), .65
        scale = max(.3, min(1.0, ocr_confidence))
        return OCRResult(invoice_number=number, invoice_date=date_value, invoice_amount=amount,
            counterparty_name=recipient, inn=inn, kpp=kpp, raw_text=text, blocks=blocks or [],
            confidence={"invoice_number": (header_score if number else 0) * scale, "invoice_date": (.94 if date_value and header else 0) * scale,
             "invoice_amount": amount_score * scale, "counterparty_name": recipient_score * scale,
             "inn": ((.99 if inn_valid else .45) if inn else 0) * scale})
