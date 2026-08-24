from decimal import Decimal

from sqlalchemy.dialects import postgresql

from app.api.routes import duplicate_invoice_query


def test_duplicate_query_ignores_invoices_of_deleted_expenses():
    query = duplicate_invoice_query(" 15 ", Decimal("785.00"))
    sql = str(query.compile(dialect=postgresql.dialect()))

    assert "JOIN expenses" in sql
    assert "expenses.deleted_at IS NULL" in sql
    assert "invoices.deleted_at IS NULL" in sql
