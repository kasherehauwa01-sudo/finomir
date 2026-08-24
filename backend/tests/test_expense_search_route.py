from app.api.routes import expenses
from app.repositories.expenses import ExpenseFilters


def test_expenses_route_wraps_search_in_filters(monkeypatch):
    captured = {}

    class Repository:
        def __init__(self, _db): pass

        def list(self, page, page_size, filters):
            captured.update(page=page, page_size=page_size, filters=filters)
            return [], 0

    monkeypatch.setattr("app.api.routes.ExpenseRepository", Repository)

    assert expenses(1, 25, "оми", object()) == {"items": [], "total": 0, "page": 1, "page_size": 25}
    assert isinstance(captured["filters"], ExpenseFilters)
    assert captured["filters"].search == "оми"
