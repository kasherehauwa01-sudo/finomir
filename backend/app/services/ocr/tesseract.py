import re
import subprocess
from datetime import datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path

from pypdf import PdfReader

from .base import OCRProvider, OCRResult


def _clean(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip(" \t:;,.\n")


def parse_invoice_text(text: str) -> OCRResult:
    """Извлекает ключевые поля из типового российского счета после OCR."""
    normalized = text.replace("\xa0", " ")
    match = re.search(r"сч[её]т\s+(?:на\s+оплату\s*)?№?\s*([\w./-]+)\s+от\s+(\d{1,2})[.\s]+([а-яА-Я]+|\d{1,2})[.\s]+(20\d{2})", normalized, re.I)
    months = {name: index + 1 for index, name in enumerate("января февраля марта апреля мая июня июля августа сентября октября ноября декабря".split())}
    invoice_date = invoice_number = None
    month = None
    if match:
        invoice_number = match.group(1)
        month = int(match.group(3)) if match.group(3).isdigit() else months.get(match.group(3).lower())
        try:
            invoice_date = datetime(int(match.group(4)), month or 0, int(match.group(2))).date().isoformat()
        except ValueError:
            pass
    amount_match = re.search(r"всего[ \t]+к[ \t]+оплате[ \t]*[:\-]?[ \t]*([\d \t]+(?:[,.]\d{2})?)", normalized, re.I)
    amount = None
    if amount_match:
        try:
            amount = Decimal(re.sub(r"\s", "", amount_match.group(1)).replace(",", "."))
        except InvalidOperation:
            pass
    recipient = None
    lines = [_clean(line) for line in normalized.splitlines() if _clean(line)]
    for index, line in enumerate(lines):
        if re.fullmatch(r"получатель", line, re.I):
            candidates = [item for item in lines[max(0, index - 3):index] if not re.search(r"^(инн|кпп|сч\.?\s*№|банк)", item, re.I)]
            recipient = candidates[-1] if candidates else (lines[index + 1] if index + 1 < len(lines) else None)
            break
    if not recipient:
        supplier = re.search(r"(?:поставщик|исполнитель)\s*[:)]*\s*(.+?)(?:,?\s+инн\b|\n)", normalized, re.I)
        recipient = _clean(supplier.group(1)) if supplier else None
    # В платежных реквизитах ИНН получателя расположен до подписи поля.
    inn = re.search(r"\bинн\s*(\d{10}|\d{12})", normalized, re.I)
    return OCRResult(counterparty_name=recipient, inn=inn.group(1) if inn else None,
        invoice_number=invoice_number, invoice_date=invoice_date, invoice_amount=amount,
        service_period={"month": month, "year": int(match.group(4)) if match else None},
        confidence={"invoice_number": .9 if invoice_number else 0, "invoice_amount": .95 if amount else 0, "counterparty_name": .8 if recipient else 0})


class TesseractOCRProvider(OCRProvider):
    def recognize(self, path: str, mime: str) -> OCRResult:
        if mime == "application/pdf":
            text = "\n".join(page.extract_text() or "" for page in PdfReader(path).pages)
            if text.strip():
                return parse_invoice_text(text)
        result = subprocess.run(["tesseract", str(Path(path)), "stdout", "-l", "rus+eng"], check=True, capture_output=True, text=True, timeout=90)
        return parse_invoice_text(result.stdout)
