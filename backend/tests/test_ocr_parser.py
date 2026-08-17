from decimal import Decimal

import pytest

from app.services.ocr.parser import OCRTextBlock, RussianInvoiceParser


@pytest.fixture
def parser() -> RussianInvoiceParser:
    return RussianInvoiceParser()


def test_text_month_date_and_total_on_next_line(parser: RussianInvoiceParser) -> None:
    result = parser.parse(
        "Счет на оплату № 33 от 18 февраля 2026 г.\nВсего к оплате:\n785,00"
    )

    assert result.invoice_number == "33"
    assert result.invoice_date == "2026-02-18"
    assert result.invoice_amount == Decimal("785.00")
    assert result.confidence["invoice_number"] > 0
    assert result.confidence["invoice_date"] > 0
    assert result.confidence["invoice_amount"] > 0


def test_short_header_digital_date_and_spaced_amount(parser: RussianInvoiceParser) -> None:
    result = parser.parse("Счёт № 125 от 03.08.2026\nИтого: 12 500,00")

    assert result.invoice_number == "125"
    assert result.invoice_date == "2026-08-03"
    assert result.invoice_amount == Decimal("12500.00")


def test_supplier_inn_has_priority_over_customer_inn(parser: RussianInvoiceParser) -> None:
    result = parser.parse(
        "Поставщик\nООО \"АПРЕС\", ИНН 3459074228, КПП 344301001\n"
        "Покупатель\nИП Куприянова Ольга Владимировна, ИНН 344309962847"
    )

    assert result.inn == "3459074228"
    assert result.kpp == "344301001"
    assert result.counterparty_name == 'ООО "АПРЕС"'


def test_payment_deadline_is_not_used_as_invoice_date(parser: RussianInvoiceParser) -> None:
    result = parser.parse(
        "Счет на оплату № 33 от 18 февраля 2026 г.\n"
        "Оплатить не позднее 24.02.2026"
    )

    assert result.invoice_date == "2026-02-18"


def test_document_total_has_priority_over_line_item_prices(parser: RussianInvoiceParser) -> None:
    result = parser.parse(
        "Счет на оплату N 33 от 18-02-2026\n"
        "Печать баннера\n2\n450,00\n900,00\nИтого: 900,00\n"
        "Всего к оплате:\n785,00"
    )

    assert result.invoice_amount == Decimal("785.00")


def test_bank_account_is_not_used_as_invoice_number(parser: RussianInvoiceParser) -> None:
    result = parser.parse("Банк получателя\nСч. №\n40702810026100002367")

    assert result.invoice_number is None


@pytest.mark.parametrize("marker", ["№", "N", "No"])
@pytest.mark.parametrize("separator", [".", "-", "/"])
def test_supported_header_markers_and_digital_date_separators(
    parser: RussianInvoiceParser, marker: str, separator: str
) -> None:
    result = parser.parse(f"Счет на оплату {marker} А-17 от 18{separator}02{separator}2026")

    assert result.invoice_number == "А-17"
    assert result.invoice_date == "2026-02-18"


def test_ocr_block_confidence_is_preserved(parser: RussianInvoiceParser) -> None:
    line = "Счет № 7 от 18.02.2026"
    result = parser.parse(line, [OCRTextBlock(line, 0.6)])

    assert 0.6 < result.confidence["invoice_number"] < 0.94


def test_invoice_number_may_be_on_next_ocr_line(parser: RussianInvoiceParser) -> None:
    result = parser.parse("Счет на оплату №\n33 от 18 февраля 2026 г.")

    assert result.invoice_number == "33"
    assert result.invoice_date == "2026-02-18"
