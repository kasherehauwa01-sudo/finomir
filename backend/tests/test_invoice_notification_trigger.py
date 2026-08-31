import uuid
from types import SimpleNamespace

from app.api.routes import attach_document, notify_expense_invoice
from app.models import Document, Expense


class ResultDb:
    def __init__(self, expense, document=None): self.expense = expense; self.document = document; self.committed = False
    def get(self, model, _item_id): return self.document if model is Document else self.expense if model is Expense else None
    def scalar(self, _query): return self.document
    def commit(self): self.committed = True


def test_attaching_invoice_does_not_send_before_save(monkeypatch):
    document = SimpleNamespace(id=uuid.uuid4(), expense_id=None, document_type="invoice", deleted_at=None)
    expense = SimpleNamespace(id=uuid.uuid4(), deleted_at=None)
    called = []
    monkeypatch.setattr("app.api.routes.notify_new_invoice", lambda *args: called.append(args))

    attach_document(document.id, expense.id, ResultDb(expense, document))

    assert document.expense_id == expense.id
    assert called == []


def test_save_triggers_notification_when_invoice_document_exists(monkeypatch):
    expense = SimpleNamespace(id=uuid.uuid4(), deleted_at=None)
    document = SimpleNamespace(id=uuid.uuid4())
    db = ResultDb(expense, document)
    called = []
    def send(document_id, current_db):
        called.append((document_id, current_db))
        return {"status": "sent", "reason": None}
    monkeypatch.setattr("app.api.routes.notify_new_invoice", send)

    assert notify_expense_invoice(expense.id, db) == {"triggered": True, "status": "sent", "reason": None}
    assert called == [(document.id, db)]


def test_save_without_invoice_document_does_not_send(monkeypatch):
    expense = SimpleNamespace(id=uuid.uuid4(), deleted_at=None)
    db = ResultDb(expense)
    called = []
    monkeypatch.setattr("app.api.routes.notify_new_invoice", lambda *args: called.append(args))

    assert notify_expense_invoice(expense.id, db) == {"triggered": False, "reason": "invoice_document_missing"}
    assert called == []
