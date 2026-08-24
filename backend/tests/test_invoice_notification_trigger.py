import uuid
from types import SimpleNamespace

from app.api.routes import attach_document
from app.models import Document, Expense


class Db:
    def __init__(self, document, expense): self.document = document; self.expense = expense; self.committed = False
    def get(self, model, _item_id): return self.document if model is Document else self.expense if model is Expense else None
    def commit(self): self.committed = True


def test_attaching_ocr_invoice_triggers_notification(monkeypatch):
    document = SimpleNamespace(id=uuid.uuid4(), expense_id=None, document_type="invoice", deleted_at=None)
    expense = SimpleNamespace(id=uuid.uuid4(), deleted_at=None)
    db = Db(document, expense)
    called = []
    monkeypatch.setattr("app.api.routes.notify_new_invoice", lambda document_id, current_db: called.append((document_id, current_db)))

    result = attach_document(document.id, expense.id, db)

    assert result == {"id": document.id}
    assert document.expense_id == expense.id
    assert called == [(document.id, db)]
    assert db.committed is True


def test_attaching_closing_document_does_not_send_notification(monkeypatch):
    document = SimpleNamespace(id=uuid.uuid4(), expense_id=None, document_type="closing", deleted_at=None)
    expense = SimpleNamespace(id=uuid.uuid4(), deleted_at=None)
    called = []
    monkeypatch.setattr("app.api.routes.notify_new_invoice", lambda *args: called.append(args))

    attach_document(document.id, expense.id, Db(document, expense))

    assert called == []
