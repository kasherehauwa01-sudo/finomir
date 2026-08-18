from datetime import date
from decimal import Decimal

import pytest
from openpyxl import Workbook

from app.services.expense_import import _date, _decimal, _find_header, _period


def test_import_value_formats():
    assert _period("Февраль 2016") == (2, 2016)
    assert _period("03/2026") == (3, 2026)
    assert _date("21.01.2016") == date(2016, 1, 21)
    assert _decimal("34 000,00р.") == Decimal("34000.00")


def test_header_row_can_contain_newlines_and_typo_from_template():
    workbook = Workbook()
    sheet = workbook.active
    sheet.append(["Отчет", None])
    sheet.append([
        "Наименование контрагента", "Суть рекламного сообщения\n", "Свид рекламы",
        "месяц/год оказания услуг ", "№ счета\n", "Дата счета", "Сумма счета с НДС\n",
    ])
    row, columns = _find_header(tuple(tuple(cell.value for cell in row) for row in sheet.iter_rows()))
    assert row == 2
    assert set(columns) == {"partner", "service", "tag", "period", "invoice_number", "invoice_date", "amount"}


def test_invalid_period_has_readable_error():
    with pytest.raises(ValueError, match="некорректный месяц/год"):
        _period("когда-нибудь")
