import uuid

from app.api.routes import ExpenseBulkDeleteIn, bulk_delete_expenses
from app.models import AuditLog, Expense


class Result:
    def __init__(self, items): self.items = items
    def unique(self): return self
    def all(self): return self.items


class Db:
    def __init__(self, expenses): self.expenses = expenses; self.added = []; self.committed = False
    def scalars(self, _query): return Result(self.expenses)
    def add(self, item): self.added.append(item)
    def commit(self): self.committed = True


def test_bulk_delete_archives_all_selected_expenses():
    expenses = [Expense(id=uuid.uuid4()), Expense(id=uuid.uuid4())]
    db = Db(expenses)

    result = bulk_delete_expenses(ExpenseBulkDeleteIn(ids=[item.id for item in expenses]), db)

    assert result == {"deleted": 2}
    assert all(item.deleted_at is not None for item in expenses)
    assert len([item for item in db.added if isinstance(item, AuditLog)]) == 2
    assert db.committed is True
