from email.message import EmailMessage

from app.config import Settings
from app.services import notifications


def test_email_contains_invoice_attachment(monkeypatch, tmp_path):
    attachment = tmp_path / "invoice.pdf"
    attachment.write_bytes(b"%PDF-test")
    sent: list[EmailMessage] = []

    class FakeSMTP:
        def __init__(self, host, port, timeout):
            assert (host, port, timeout) == ("smtp.test", 587, 20)

        def __enter__(self): return self
        def __exit__(self, *_): return None
        def starttls(self): return None
        def login(self, username, password): assert (username, password) == ("user", "secret")
        def send_message(self, message): sent.append(message)

    monkeypatch.setattr(notifications.smtplib, "SMTP", FakeSMTP)
    settings = Settings(
        smtp_host="smtp.test", smtp_username="user", smtp_password="secret",
        smtp_from="finomir@test", accounting_email_to="accounting@test",
    )

    assert notifications.send_accounting_email(
        settings,
        subject="Счет на оплату: Печать",
        message="Текст уведомления",
        attachment_path=str(attachment),
        attachment_name="Счет.pdf",
        attachment_mime="application/pdf",
    )
    assert len(sent) == 1
    assert sent[0].get_body(preferencelist=("plain",)).get_content().strip() == "Текст уведомления"
    assert sent[0].iter_attachments().__next__().get_filename() == "Счет.pdf"
