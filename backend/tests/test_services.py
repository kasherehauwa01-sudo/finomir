from decimal import Decimal
import pytest
from app.services.finance import allocation_totals,expense_totals,invoice_totals
from app.services.duplicates import normalize_inn,normalize_number
from app.services.storage import validate_file
from app.services.ocr.parser import RussianInvoiceParser,validate_inn
from app.api.routes import ExpenseBulkUpdateIn,router
from app.services.notifications import accounting_message
def test_payments(): assert invoice_totals(Decimal("100000"),[Decimal("40000"),Decimal("35000")])==(Decimal("75000"),Decimal("25000"))
def test_multiple_invoices(): assert expense_totals([(Decimal("100"),[Decimal("25")]),(Decimal("50"),[Decimal("50")])])==(Decimal("150"),Decimal("75"),Decimal("75"))
def test_allocations(): assert allocation_totals(Decimal("100000"),[Decimal("40000"),Decimal("35000"),Decimal("25000")])==(Decimal("100000"),Decimal("0"))
def test_normalization(): assert normalize_inn("77 01-234567")=="7701234567" and normalize_number("Счёт № AB-12")=="счётab12"
def test_file_validation():
 assert validate_file("x.jpeg","image/jpeg",10,1)==".jpg"
 with pytest.raises(ValueError): validate_file("../x.exe","application/pdf",10,1)

def test_bulk_update_distinguishes_omitted_fields():
 expense_id="00000000-0000-0000-0000-000000000001"
 payload=ExpenseBulkUpdateIn(expense_ids=[expense_id],tag_ids=[])
 assert payload.model_fields_set=={"expense_ids","tag_ids"}

def test_bulk_update_route_precedes_expense_uuid_route():
 put_paths=[route.path for route in router.routes if "PUT" in getattr(route,"methods",set()) and route.path.startswith("/expenses/")]
 assert put_paths.index("/expenses/bulk/update")<put_paths.index("/expenses/{expense_id}")

def test_accounting_message_lists_regular_stores():
 message=accounting_message("Печать",Decimal("6200"),["Козловская","Авиаторов"])
 assert "Платеж относится к магазинам:\n\nКозловская\nАвиаторов" in message
 assert "Сумма счета: 6200.00 ₽" in message

def test_accounting_message_for_internet_store_uses_entrepreneur():
 message=accounting_message("Реклама",Decimal("7140"),["Интернет (w)"])
 assert "Платеж относится к ИП Куприянова О.В.:" in message
 assert "Платеж относится к магазинам" not in message

@pytest.mark.parametrize(("text","number","invoice_date","amount"),[
 ('Счет № 123 от 15.08.2026\nИтого 12 500,00', '123','2026-08-15','12500.00'),
 ('Счёт № 123-45 от 15-08-2026\nВсего: 12500.00', '123-45','2026-08-15','12500.00'),
 ('Счет на оплату № АБ-123 от 15 августа 2026 г.\nВсего к оплате 12 500 руб.', 'АБ-123','2026-08-15','12500.00'),
 ('Счет на оплату N 123/2026 от 15.08.26\nИтого к оплате: 12500,00 ₽', '123/2026','2026-08-15','12500.00'),
 ('СЧЕТ №БП-0000123 от 01.01.2026\nСумма счета: 1 000,50', 'БП-0000123','2026-01-01','1000.50'),
 ('Дата договора 01.01.2025\nСчет № 77 от 10.02.2026\nВсего к оплате: 500', '77','2026-02-10','500.00'),
 ('Счет № 8 от 3 марта 2026 г.\nЦена: 10000\nНДС: 2000\nВсего к оплате: 12000', '8','2026-03-03','12000.00'),
 ('Счет №9 от 04/04/2026\nИтого 9 999.99 руб.', '9','2026-04-04','9999.99'),
 ('Счет №10 от 05.05.2026\nВсего 12345', '10','2026-05-05','12345.00'),
 ('Счет на оплату № 11/45 от 6 июня 2026\nВсего к оплате: 44 000,00', '11/45','2026-06-06','44000.00'),
 ('Счет N 12 от 07.07.26\nИтого к оплате 7 700,7', '12','2026-07-07','7700.70'),
 ('СЧЕТ №13-1 от 8-08-2026\nСумма счета 80 000 ₽', '13-1','2026-08-08','80000.00'),
 ('Счет № 14 от 09.09.2026\nЦена 1\nВсего к оплате 2 000.00', '14','2026-09-09','2000.00'),
 ('Счёт на оплату №15 от 10 октября 2026 г.\nИтого: 3 000,00 руб.', '15','2026-10-10','3000.00'),
 ('Счет №16 от 11.11.2026\nВсего к оплате: 4 000', '16','2026-11-11','4000.00'),
])
def test_invoice_variants(text,number,invoice_date,amount):
 result=RussianInvoiceParser().parse(text)
 assert (result.invoice_number,result.invoice_date,result.invoice_amount)==(number,invoice_date,Decimal(amount))

def test_recipient_inn_and_bank_details():
 text='БИК 044525225\nСч. № 40702810900000000001\nПоставщик: ООО "Ромашка", ИНН/КПП 7707083893/770701001\nСчет № 1 от 01.01.2026\nВсего к оплате 100,00'
 result=RussianInvoiceParser().parse(text)
 assert result.counterparty_name=='ООО "Ромашка"' and result.inn=='7707083893'

def test_individual_entrepreneur_and_twelve_digit_inn():
 result=RussianInvoiceParser().parse('Исполнитель: ИП Иванов Иван Иванович, ИНН: 500100732259\nСчет №2 от 02.02.2026\nИтого 200')
 assert result.counterparty_name.startswith('ИП Иванов') and result.inn=='500100732259'

def test_bad_ocr_text_does_not_invent_fields():
 result=RussianInvoiceParser().parse('БИК 0445 OOO шум 123456 р/с 40702810')
 assert result.invoice_number is None and result.invoice_amount is None and result.inn is None

@pytest.mark.parametrize(("inn","valid"),[("7707083893",True),("7707083894",False),("500100732259",True),("500100732258",False)])
def test_inn_checksum(inn,valid): assert validate_inn(inn) is valid
