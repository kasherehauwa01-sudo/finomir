from app.api.routes import expenses
from app.repositories.expenses import ExpenseFilters


def test_expenses_route_wraps_search_in_filters(monkeypatch):
    captured = {}

    class Repository:
        def __init__(self, _db): pass

        def list(self, page, page_size, filters, sort_by, sort_order):
            captured.update(page=page, page_size=page_size, filters=filters, sort_by=sort_by, sort_order=sort_order)
            return [], 0

    monkeypatch.setattr("app.api.routes.ExpenseRepository", Repository)

    assert expenses(page=1, page_size=25, search="оми", period=None, payment_status="all", partner_ids=[], counterparty_ids=[], store_ids=[], tag_ids=[], amount_from=None, amount_to=None, invoice_date_from=None, invoice_date_to=None, invoice_document="all", closing_document="all", sort_by="invoice_date", sort_order="desc", db=object()) == {"items": [], "total": 0, "page": 1, "page_size": 25}
    assert isinstance(captured["filters"], ExpenseFilters)
    assert captured["filters"].search == "оми"
