import logging
import mimetypes
import smtplib
from decimal import Decimal
from email.message import EmailMessage
from pathlib import Path

from app.config import Settings

logger = logging.getLogger(__name__)
INTERNET_STORE = "Интернет (w)"


def accounting_message(service_name: str, invoice_amount: Decimal, stores: list[str]) -> str:
    """Формирует текст уведомления для бухгалтерии без HTML-экранирования."""
    amount = f"{invoice_amount:.2f}"
    if any(name.strip().casefold() == INTERNET_STORE.casefold() for name in stores):
        return (
            "Прошу переслать счет в бухгалтерию.\n\n"
            f"Услуга: {service_name}\n"
            f"Сумма счета: {amount} ₽\n\n"
            "Платеж относится к ИП Куприянова О.В.:\n\n"
            "Счет на оплату прикреплен к письму."
        )
    store_lines = "\n".join(stores) if stores else "Не указаны"
    return (
        "Прошу переслать счет в бухгалтерию.\n\n"
        f"Услуга: {service_name}\n"
        f"Сумма счета: {amount} ₽\n\n"
        "Платеж относится к магазинам:\n\n"
        f"{store_lines}\n\n"
        "Счет на оплату прикреплен к письму."
    )


def send_accounting_email(
    settings: Settings,
    *,
    subject: str,
    message: str,
    attachment_path: str,
    attachment_name: str,
    attachment_mime: str,
) -> bool:
    """Отправляет письмо, если SMTP полностью настроен; финансовую запись не откатывает."""
    if not settings.smtp_host or not settings.accounting_email_to or not settings.smtp_from:
        logger.info("Accounting email skipped: SMTP_HOST, SMTP_FROM or ACCOUNTING_EMAIL_TO is not configured")
        return False
    email = EmailMessage()
    email["Subject"] = subject
    email["From"] = settings.smtp_from
    email["To"] = settings.accounting_email_to
    email.set_content(message)
    mime = attachment_mime or mimetypes.guess_type(attachment_name)[0] or "application/octet-stream"
    maintype, subtype = mime.split("/", 1)
    email.add_attachment(Path(attachment_path).read_bytes(), maintype=maintype, subtype=subtype, filename=attachment_name)
    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=settings.smtp_timeout_seconds) as smtp:
            if settings.smtp_starttls: smtp.starttls()
            if settings.smtp_username: smtp.login(settings.smtp_username, settings.smtp_password or "")
            smtp.send_message(email)
        return True
    except Exception:
        logger.exception("Failed to send accounting email")
        return False
