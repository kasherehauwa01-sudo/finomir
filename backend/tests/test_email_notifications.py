from datetime import date, datetime
from types import SimpleNamespace

import pytest

from app.api.notifications import TestEmailIn as EmailTestInput, smtp_out, test_smtp as run_smtp_test
from app.models import NotificationLog
from app.services.email import EmailAttachment, send_email
from app.services.notifications import notify_new_invoice, render


class SMTP:
    instances = []
    def __init__(self, host, port, timeout): self.host=host; self.port=port; self.messages=[]; self.started_tls=False; SMTP.instances.append(self)
    def starttls(self): self.started_tls=True
    def login(self, username, password): self.login_data=(username,password)
    def send_message(self, message, to_addrs): self.messages.append((message,to_addrs))
    def quit(self): pass


def settings(security="ssl"):
    return SimpleNamespace(host="smtp.example.test",port=465,security=security,username=None,password_encrypted=None,from_email="finomir@example.test",from_name="Finomir")


def test_email_service_sends_one_mime_message_to_all_recipients_with_original_attachment(monkeypatch):
    SMTP.instances.clear(); monkeypatch.setattr("app.services.email.smtplib.SMTP_SSL",SMTP)
    attachment=EmailAttachment("original.pdf","application/pdf",b"original PDF")
    send_email(settings(),["one@example.test","two@example.test"],"Subject","Body",[attachment])
    message,recipients=SMTP.instances[0].messages[0]
    assert recipients==["one@example.test","two@example.test"]
    assert message.get_content_type()=="multipart/mixed"
    assert message.get_payload()[1].get_content_type()=="application/pdf"
    assert message.get_payload()[1].get_filename()=="original.pdf"
    assert message.get_payload()[1].get_payload(decode=True)==b"original PDF"


def test_starttls_is_used(monkeypatch):
    SMTP.instances.clear(); monkeypatch.setattr("app.services.email.smtplib.SMTP",SMTP)
    send_email(settings("starttls"),["one@example.test"],"Subject","Body")
    assert SMTP.instances[0].started_tls is True


def test_password_is_never_returned_by_smtp_api_serializer():
    values=settings().__dict__.copy(); values.update(password_encrypted="SECRET-CIPHERTEXT",status="configured",last_error=None); item=SimpleNamespace(**values)
    result=smtp_out(item)
    assert result["password_set"] is True
    assert "password" not in result and "password_encrypted" not in result


def test_notification_template_variables():
    assert render("Счет {{invoice_number}}: {{stores}}",{"invoice_number":"15","stores":"- Магазин."})=="Счет 15: - Магазин."


def test_failed_invoice_notification_is_retried_on_next_save(monkeypatch):
    document = SimpleNamespace(id="document-id", document_type="invoice", expense_id="expense-id", original_filename="invoice.pdf", storage_path="/invoice.pdf", mime_type="application/pdf", file_size=10)
    invoice = SimpleNamespace(id="invoice-id", amount=10, invoice_number="15", invoice_date=date(2026, 8, 31), deleted_at=None, created_at=datetime.now())
    expense = SimpleNamespace(id="expense-id", service_name="Услуга", partner=SimpleNamespace(name="Партнер"), counterparty=SimpleNamespace(full_name="Контрагент"), allocations=[], invoices=[invoice])
    scenario = SimpleNamespace(enabled=True, recipients=["user@example.test"], subject_template="Счет", body_template="Текст")
    failed_log = SimpleNamespace(status="error")

    class NotificationDb:
        def __init__(self): self.scalars = iter((failed_log, scenario, expense, settings())); self.commits = 0
        def scalar(self, _query): return next(self.scalars)
        def get(self, _model, _id): return document
        def add(self, _item): raise AssertionError("Существующий журнал не должен добавляться повторно")
        def commit(self): self.commits += 1

    sent = []
    monkeypatch.setattr("app.services.notifications.load_attachment", lambda *_: EmailAttachment("invoice.pdf", "application/pdf", b"pdf"))
    monkeypatch.setattr("app.services.notifications.send_email", lambda *args: sent.append(args))
    db = NotificationDb()

    notify_new_invoice(document.id, db)

    assert len(sent) == 1
    assert failed_log.status == "sent"
    assert failed_log.error is None
    assert db.commits == 1


class Db:
    def __init__(self,item):self.item=item;self.added=[];self.commits=0
    def scalar(self,_):return self.item
    def add(self,item):self.added.append(item)
    def commit(self):self.commits+=1


def test_smtp_test_success_and_error_are_written_to_history(monkeypatch):
    item=settings(); item.status="configured"; item.last_error=None
    db=Db(item); monkeypatch.setattr("app.api.notifications.send_email",lambda *args:None)
    assert run_smtp_test(EmailTestInput(recipient="user@example.test"),db)["message"].startswith("Тестовое")
    assert next(x for x in db.added if isinstance(x,NotificationLog)).status=="sent"
    failed=Db(item); monkeypatch.setattr("app.api.notifications.send_email",lambda *args:(_ for _ in ()).throw(ConnectionError("connection refused")))
    with pytest.raises(Exception):run_smtp_test(EmailTestInput(recipient="user@example.test"),failed)
    log=next(x for x in failed.added if isinstance(x,NotificationLog))
    assert log.status=="error" and "connection refused" in log.error and item.status=="error"
