import uuid

from app.api.routes import ExpenseBulkUpdateIn, bulk_update_expenses
from app.models import AuditLog, Expense, Partner


class Result:
    def __init__(self, items): self.items = items
    def unique(self): return self
    def all(self): return self.items


class Db:
    def __init__(self, expenses, partner):
        self.expenses = expenses
        self.partner = partner
        self.added = []
        self.committed = False

    def scalars(self, _query): return Result(self.expenses)
    def get(self, model, item_id):
        return self.partner if model is Partner and item_id == self.partner.id else None
    def add(self, item): self.added.append(item)
    def commit(self): self.committed = True


def test_bulk_update_replaces_partner_relationship_for_every_expense():
    old_partner = Partner(id=uuid.uuid4(), name="Старый партнер")
    new_partner = Partner(id=uuid.uuid4(), name="Новый партнер")
    expenses = [Expense(id=uuid.uuid4(), partner=old_partner), Expense(id=uuid.uuid4(), partner=old_partner)]
    db = Db(expenses, new_partner)

    result = bulk_update_expenses(
        ExpenseBulkUpdateIn(expense_ids=[item.id for item in expenses], partner_id=new_partner.id),
        db,
    )

    assert result == {"updated": 2}
    assert all(item.partner is new_partner for item in expenses)
    assert len([item for item in db.added if isinstance(item, AuditLog)]) == 2
    assert db.committed is True
