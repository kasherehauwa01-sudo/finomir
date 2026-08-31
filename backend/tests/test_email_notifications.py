from types import SimpleNamespace

import pytest

from app.api.notifications import TestEmailIn as EmailTestInput, smtp_out, test_smtp as run_smtp_test
from app.models import NotificationLog
from app.services.email import EmailAttachment, send_email
from app.services.notifications import DEFAULT_BODY, INTERNET_STORE_BODY, body_template_for_stores, render


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


def test_internet_store_uses_sole_proprietor_notification_body():
    template = body_template_for_stores(DEFAULT_BODY, ["Магазин", "Интернет (w)"])
    body = render(template, {"service_name": "Реклама", "invoice_amount": "15 000,00"})

    assert template == INTERNET_STORE_BODY
    assert body == "Прошу переслать счет в бухгалтерию.\n\nУслуга: Реклама\nСумма счета: 15 000,00 ₽\n\nПлатеж относится к ИП Куприянова О.В.:\n\nСчет на оплату прикреплен к письму."


def test_other_stores_keep_configured_notification_body():
    configured = "Пользовательский шаблон: {{stores}}"
    assert body_template_for_stores(configured, ["Офлайн-магазин"]) == configured


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
