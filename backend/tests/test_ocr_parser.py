from decimal import Decimal

import pytest

from app.services.ocr.parser import RussianInvoiceParser


REAL_APRES_TEXT = '''
ФИЛИАЛ "РОСТОВСКИЙ" АО "АЛЬФА-БАНК"
Банк получателя
ИНН
3459074228
КПП
344301001
ООО "АПРЕС"
Получатель
Счет на оплату № 253 от 27 июля 2026 г.
Поставщик
ООО "АПРЕС", ИНН 3459074228, КПП 344301001
Покупатель
ИП Куприянова Ольга Владимировна, ИНН 344309962847
Итого:
7 140,00
Всего к оплате:
7 140,00
'''


def test_real_apres_invoice():
    result = RussianInvoiceParser().parse(REAL_APRES_TEXT)
    assert result.invoice_number == "253"
    assert result.invoice_date == "2026-07-27"
    assert result.invoice_amount == Decimal("7140.00")
    assert result.inn == "3459074228"
    assert result.kpp == "344301001"
    assert result.counterparty_name == 'ООО "АПРЕС"'


def test_apres_invoice_recognizes_supplier_and_service_row():
    text = '''
Счет на оплату № 298 от 25 августа 2026 г.
Поставщик (Исполнитель): ООО "АПРЕС", ИНН 3459074228, КПП 344301001
Покупатель (Заказчик): ИП Куприянова Ольга Владимировна, ИНН 344309962847
№  Товары (работы, услуги)  Кол-во  Ед.  Цена  Сумма
1  Печать баннеров интерьерная 1,6*0,6 с люверсами  10  шт  595,00  5 950,00
Итого: 5 950,00
Всего к оплате: 5 950,00
'''
    result = RussianInvoiceParser().parse(text)
    assert result.counterparty_name == 'ООО "АПРЕС"'
    assert result.service_name == "Печать баннеров интерьерная 1,6*0,6 с люверсами"
    assert result.confidence["service_name"] == .9


@pytest.mark.parametrize(("header", "number", "invoice_date"), [
    ("Счёт на оплату № 253 от 27 июля 2026 г.", "253", "2026-07-27"),
    ("Счет № 253 от 27.07.2026", "253", "2026-07-27"),
    ("Счёт №АБ-125/2026 от 27-07-2026", "АБ-125/2026", "2026-07-27"),
    ("Счет на оплату No СЧ-253 от 27/07/2026", "СЧ-253", "2026-07-27"),
    ("Cчет на оплату N А-253 от 27 июля 2026", "А-253", "2026-07-27"),
])
def test_header_variants(header, number, invoice_date):
    result = RussianInvoiceParser().parse(header)
    assert result.invoice_number == number
    assert result.invoice_date == invoice_date


@pytest.mark.parametrize("text", [
    "Всего к оплате: 7 140,00",
    "Всего к оплате:\n7 140,00",
    "Итого к оплате: 7 140.00",
    "К оплате 7140,00",
])
def test_amount_variants(text):
    assert RussianInvoiceParser().parse(text).invoice_amount == Decimal("7140.00")


def test_total_phrase_has_priority_over_item_price():
    text = "Цена: 2 000,00\nИтого: 5 000,00\nВсего к оплате:\n7 140,00"
    assert RussianInvoiceParser().parse(text).invoice_amount == Decimal("7140.00")


def test_supplier_inn_has_priority_over_buyer_inn():
    result = RussianInvoiceParser().parse(
        'Поставщик\nООО "АПРЕС", ИНН 3459074228\n'
        'Покупатель\nИП Куприянова, ИНН 344309962847'
    )
    assert result.inn == "3459074228"
    assert result.counterparty_name == 'ООО "АПРЕС"'


def test_bank_account_is_not_invoice_number():
    result = RussianInvoiceParser().parse("БИК 046015207\nСч. № 40702810000000000236\nИНН 3459074228")
    assert result.invoice_number is None
    assert result.confidence["invoice_number"] == 0


@pytest.mark.parametrize(("text", "missing"), [
    ("Всего к оплате 100,00", "number"),
    ("Счет № 10 от 01.01.2026", "amount"),
    ("Счет № 10\nВсего к оплате 100,00", "date"),
])
def test_missing_fields_are_not_invented(text, missing):
    result = RussianInvoiceParser().parse(text)
    assert getattr(result, f"invoice_{missing}") is None
    assert result.confidence[f"invoice_{missing}"] == 0


def test_random_word_after_title_is_not_a_number():
    result = RussianInvoiceParser().parse("Счет на оплату НОГО от 27 июля 2026")
    assert result.invoice_number is None
    assert result.confidence["invoice_number"] == 0
