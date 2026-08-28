import uuid

from sqlalchemy.dialects import postgresql

from app.api.routes import dashboard


class Result:
    def unique(self): return self
    def all(self): return []


class Db:
    def __init__(self): self.query = None
    def scalars(self, query): self.query = query; return Result()


def test_dashboard_filters_by_partner_and_counterparty():
    db = Db()

    result = dashboard(period="year", tag_ids=[], store_ids=[], partner_ids=[uuid.uuid4()], counterparty_ids=[uuid.uuid4()], payment_status="unpaid", db=db)
    sql = str(db.query.compile(dialect=postgresql.dialect()))

    assert "expenses.partner_id" in sql
    assert "expenses.counterparty_id" in sql
    assert result["expense_count"] == 0
