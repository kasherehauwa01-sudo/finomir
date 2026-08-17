from decimal import Decimal
import pytest
from app.services.finance import allocation_totals,expense_totals,invoice_totals
from app.services.duplicates import normalize_inn,normalize_number
from app.services.storage import validate_file
from app.services.ocr.tesseract import parse_invoice_text
def test_payments(): assert invoice_totals(Decimal("100000"),[Decimal("40000"),Decimal("35000")])==(Decimal("75000"),Decimal("25000"))
def test_multiple_invoices(): assert expense_totals([(Decimal("100"),[Decimal("25")]),(Decimal("50"),[Decimal("50")])])==(Decimal("150"),Decimal("75"),Decimal("75"))
def test_allocations(): assert allocation_totals(Decimal("100000"),[Decimal("40000"),Decimal("35000"),Decimal("25000")])==(Decimal("100000"),Decimal("0"))
def test_normalization(): assert normalize_inn("77 01-234567")=="7701234567" and normalize_number("Счёт № AB-12")=="счётab12"
def test_file_validation():
 assert validate_file("x.jpeg","image/jpeg",10,1)==".jpg"
 with pytest.raises(ValueError): validate_file("../x.exe","application/pdf",10,1)

def test_russian_invoice_recognition():
 text='''ИНН 3459074228 КПП 344301001
ООО "АПРЕС"
Получатель
Счет на оплату № 61 от 12 марта 2026 г.
Всего к оплате: 6 200,00'''
 result=parse_invoice_text(text)
 assert result.counterparty_name=='ООО "АПРЕС"'
 assert result.inn=="3459074228"
 assert result.invoice_number=="61"
 assert result.invoice_date=="2026-03-12"
 assert result.invoice_amount==Decimal("6200.00")
