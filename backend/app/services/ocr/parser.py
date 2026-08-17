import re
from dataclasses import dataclass
from datetime import date
from decimal import Decimal, InvalidOperation
from typing import Iterable

from .base import OCRResult


RUSSIAN_MONTHS = {
    "января": 1,
    "февраля": 2,
    "марта": 3,
    "апреля": 4,
    "мая": 5,
    "июня": 6,
    "июля": 7,
    "августа": 8,
    "сентября": 9,
    "октября": 10,
    "ноября": 11,
    "декабря": 12,
}

INVOICE_HEADER_RE = re.compile(
    r"\bсч[её]т\s*(?:на\s+оплату\s*)?(?:№|n(?:o)?\.?)\s*"
    r"(?P<number>[0-9A-Za-zА-Яа-яЁё]+(?:[-/][0-9A-Za-zА-Яа-яЁё]+)*)",
    re.IGNORECASE,
)
TEXT_DATE_RE = re.compile(
    r"\b(?P<day>0?[1-9]|[12]\d|3[01])\s+"
    r"(?P<month>января|февраля|марта|апреля|мая|июня|июля|августа|"
    r"сентября|октября|ноября|декабря)\s+"
    r"(?P<year>20\d{2})(?:\s*г\.?)?\b",
    re.IGNORECASE,
)
DIGITAL_DATE_RE = re.compile(
    r"\b(?P<day>0?[1-9]|[12]\d|3[01])[.\-/]"
    r"(?P<month>0?[1-9]|1[0-2])[.\-/](?P<year>20\d{2})\b"
)
MONEY_RE = re.compile(r"(?<!\d)(\d{1,3}(?:[ \u00a0]\d{3})*|\d+)[,.](\d{2})(?!\d)")
INN_RE = re.compile(r"(?:и[нh]{2})\s*[:№]?\s*(\d[\d\s-]{8,15}\d)", re.IGNORECASE)
KPP_RE = re.compile(r"(?:к|k)пп\s*[:№]?\s*(\d{9})", re.IGNORECASE)
ORGANIZATION_RE = re.compile(
    r"\b(?:ООО|ИП|АО|ПАО|ЗАО|ОАО|НКО|ГУП|МУП)\b[^,;\n]*",
    re.IGNORECASE,
)


@dataclass(frozen=True)
class OCRTextBlock:
    text: str
    confidence: float


class RussianInvoiceParser:
    """Извлекает реквизиты счета из уже распознанного русского текста."""

    def parse(
        self,
        raw_text: str,
        blocks: Iterable[OCRTextBlock | tuple[str, float]] | None = None,
    ) -> OCRResult:
        lines = [self._clean_line(line) for line in raw_text.splitlines() if line.strip()]
        confidence_map = self._confidence_map(blocks)
        result = OCRResult()

        header_index, header_match = self._find_invoice_header(lines)
        if header_match is not None:
            result.invoice_number = header_match.group("number").strip(" .")
            result.confidence["invoice_number"] = self._field_confidence(
                lines[header_index], confidence_map, 0.94
            )

            invoice_date = self._date_near_header(lines, header_index, header_match.end())
            if invoice_date is not None:
                result.invoice_date = invoice_date.isoformat()
                result.confidence["invoice_date"] = self._field_confidence(
                    lines[header_index], confidence_map, 0.92
                )

        amount, amount_line = self._find_total(lines)
        if amount is not None:
            result.invoice_amount = amount
            result.confidence["invoice_amount"] = self._field_confidence(
                amount_line, confidence_map, 0.93
            )

        counterparty_name, inn, kpp, party_line = self._find_supplier(lines)
        result.counterparty_name = counterparty_name
        result.inn = inn
        result.kpp = kpp
        if counterparty_name:
            result.confidence["counterparty_name"] = self._field_confidence(
                party_line, confidence_map, 0.88
            )
        if inn:
            result.confidence["inn"] = self._field_confidence(party_line, confidence_map, 0.91)
        if kpp:
            result.confidence["kpp"] = self._field_confidence(party_line, confidence_map, 0.89)

        return result

    @staticmethod
    def _clean_line(line: str) -> str:
        return re.sub(r"[ \t\u00a0]+", " ", line).strip()

    @staticmethod
    def _confidence_map(
        blocks: Iterable[OCRTextBlock | tuple[str, float]] | None,
    ) -> dict[str, float]:
        values: dict[str, float] = {}
        for block in blocks or ():
            text, score = (block.text, block.confidence) if isinstance(block, OCRTextBlock) else block
            clean_text = RussianInvoiceParser._clean_line(text)
            values[clean_text.casefold()] = max(0.0, min(float(score), 1.0))
        return values

    @staticmethod
    def _field_confidence(line: str, confidence_map: dict[str, float], contextual: float) -> float:
        ocr_confidence = confidence_map.get(line.casefold())
        if ocr_confidence is None:
            return contextual
        # Контекст шаблона важен, но итоговая оценка не должна скрывать низкое качество OCR.
        return round((ocr_confidence * 0.7) + (contextual * 0.3), 3)

    @staticmethod
    def _find_invoice_header(lines: list[str]) -> tuple[int, re.Match[str] | None]:
        for index, line in enumerate(lines):
            match = INVOICE_HEADER_RE.search(line)
            if match:
                return index, match
            # PaddleOCR иногда выделяет номер отдельным текстовым блоком. Склеиваем
            # только строку, которая заканчивается явным маркером номера счета.
            if index + 1 < len(lines) and re.search(
                r"\bсч[её]т\s*(?:на\s+оплату\s*)?(?:№|n(?:o)?\.?)\s*$",
                line,
                re.IGNORECASE,
            ):
                match = INVOICE_HEADER_RE.search(f"{line} {lines[index + 1]}")
                if match:
                    return index, match
        return -1, None

    @staticmethod
    def _date_near_header(lines: list[str], header_index: int, number_end: int) -> date | None:
        # Сначала разбираем остаток заголовка, затем одну следующую строку — это исключает
        # попадание срока оплаты, находящегося ниже в документе.
        candidates = [lines[header_index][number_end:]]
        if header_index + 1 < len(lines):
            candidates.append(lines[header_index + 1])
        for candidate in candidates:
            for pattern in (TEXT_DATE_RE, DIGITAL_DATE_RE):
                match = pattern.search(candidate)
                if not match:
                    continue
                month_value = match.group("month").casefold()
                month = RUSSIAN_MONTHS.get(month_value, int(month_value) if month_value.isdigit() else 0)
                try:
                    return date(int(match.group("year")), month, int(match.group("day")))
                except ValueError:
                    continue
        return None

    @staticmethod
    def _find_total(lines: list[str]) -> tuple[Decimal | None, str]:
        markers = (
            re.compile(r"^всего\s+к\s+оплате\s*:?", re.IGNORECASE),
            re.compile(r"^к\s+оплате\s*:?", re.IGNORECASE),
            re.compile(r"^всего\s*:?", re.IGNORECASE),
            re.compile(r"^итого\s*:?", re.IGNORECASE),
        )
        for marker in markers:
            for index, line in enumerate(lines):
                marker_match = marker.match(line)
                if not marker_match:
                    continue
                # Сумма бывает после двоеточия либо переносится на следующую строку.
                candidates = [line[marker_match.end():]]
                if index + 1 < len(lines):
                    candidates.append(lines[index + 1])
                for candidate in candidates:
                    amount = RussianInvoiceParser._parse_money(candidate)
                    if amount is not None:
                        return amount, line
        return None, ""

    @staticmethod
    def _parse_money(value: str) -> Decimal | None:
        match = MONEY_RE.search(value)
        if not match:
            return None
        normalized = re.sub(r"[ \u00a0]", "", match.group(1)) + "." + match.group(2)
        try:
            return Decimal(normalized)
        except InvalidOperation:
            return None

    @staticmethod
    def _find_supplier(lines: list[str]) -> tuple[str | None, str | None, str | None, str]:
        sections = (
            re.compile(r"\bпоставщик\b", re.IGNORECASE),
            re.compile(r"\bисполнитель\b", re.IGNORECASE),
            re.compile(r"\bполучатель\b", re.IGNORECASE),
        )
        stop = re.compile(r"\b(?:покупатель|заказчик)\b", re.IGNORECASE)
        for section in sections:
            for index, line in enumerate(lines):
                match = section.search(line)
                if not match:
                    continue
                context_lines = [line[match.end():]]
                for following in lines[index + 1:index + 5]:
                    if stop.search(following):
                        break
                    context_lines.append(following)
                context = "\n".join(context_lines)
                organization = ORGANIZATION_RE.search(context)
                inn_match = INN_RE.search(context)
                kpp_match = KPP_RE.search(context)
                if organization or inn_match:
                    name = organization.group(0).strip(" ,:") if organization else None
                    inn = re.sub(r"\D", "", inn_match.group(1)) if inn_match else None
                    kpp = kpp_match.group(1) if kpp_match else None
                    return name, inn, kpp, next(
                        (item for item in context_lines if (name and name in item) or (inn and inn in re.sub(r"\D", "", item))),
                        line,
                    )
        return None, None, None, ""
