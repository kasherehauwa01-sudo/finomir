from types import SimpleNamespace

from app.api.routes import has_cash_payment


def test_cash_payment_marker_recognizes_cash_invoice():
    invoices = [
        SimpleNamespace(invoice_number="  НАЛИЧНЫЕ ", deleted_at=None),
        SimpleNamespace(invoice_number="15", deleted_at=None),
    ]

    assert has_cash_payment(invoices) is True


def test_cash_payment_marker_ignores_deleted_invoice():
    invoices = [SimpleNamespace(invoice_number="Наличные", deleted_at="2026-08-24")]

    assert has_cash_payment(invoices) is False
