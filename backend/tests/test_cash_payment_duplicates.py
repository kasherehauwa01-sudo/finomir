import uuid
from datetime import date
from decimal import Decimal

from app.api.routes import InvoiceIn, add_invoice
from app.models import Expense, Invoice


class Db:
    def __init__(self, expense, duplicate):
        self.expense = expense
        self.duplicate = duplicate
        self.added = []

    def get(self, model, _item_id):
        return self.expense if model is Expense else None

    def scalar(self, _query):
        return self.duplicate

    def add(self, item):
        self.added.append(item)

    def flush(self):
        pass

    def commit(self):
        pass


def test_cash_payment_can_repeat_number_and_amount():
    expense = Expense(id=uuid.uuid4(), partner_id=uuid.uuid4(), counterparty_id=uuid.uuid4(), service_name="Услуга", expense_month=8, expense_year=2026)
    duplicate = Invoice(id=uuid.uuid4(), expense_id=uuid.uuid4(), invoice_number="Наличные", invoice_date=date(2026, 8, 24), amount=Decimal("1000"))
    db = Db(expense, duplicate)

    result = add_invoice(expense.id, InvoiceIn(invoice_number="Наличные", invoice_date=date(2026, 8, 24), amount=Decimal("1000"), allow_duplicate=True), db)

    assert "id" in result
    assert any(isinstance(item, Invoice) for item in db.added)
