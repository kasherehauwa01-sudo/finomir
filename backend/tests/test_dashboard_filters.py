import uuid

from sqlalchemy.dialects import postgresql

from decimal import Decimal
from types import SimpleNamespace

from app.api.routes import dashboard, outstanding_total


class Result:
    def unique(self): return self
    def all(self): return []


class Db:
    def __init__(self): self.query = None
    def scalars(self, query): self.query = query; return Result()


def test_dashboard_filters_by_partner_and_counterparty():
    db = Db()

    result = dashboard(period="year", tag_ids=[], store_ids=[], partner_ids=[uuid.uuid4()], counterparty_ids=[uuid.uuid4()], payment_status="unpaid", db=db)
    sql = str(db.query.compile(dialect=postgresql.dialect()))

    assert "expenses.partner_id" in sql
    assert "expenses.counterparty_id" in sql
    assert result["expense_count"] == 0


def test_outstanding_total_only_sums_positive_active_balances():
    active_payment = SimpleNamespace(amount=Decimal("25"), deleted_at=None)
    deleted_payment = SimpleNamespace(amount=Decimal("100"), deleted_at=object())
    unpaid_invoice = SimpleNamespace(amount=Decimal("100"), deleted_at=None, payments=[active_payment, deleted_payment])
    overpaid_invoice = SimpleNamespace(amount=Decimal("20"), deleted_at=None, payments=[SimpleNamespace(amount=Decimal("30"), deleted_at=None)])
    deleted_invoice = SimpleNamespace(amount=Decimal("500"), deleted_at=object(), payments=[])
    expenses = [SimpleNamespace(invoices=[unpaid_invoice, deleted_invoice]), SimpleNamespace(invoices=[overpaid_invoice])]

    class OutstandingDb:
        def scalars(self, _query): return ResultWithItems(expenses)

    class ResultWithItems(Result):
        def __init__(self, items): self.items = items
        def all(self): return self.items

    assert outstanding_total(db=OutstandingDb()) == {"total": Decimal("75")}
