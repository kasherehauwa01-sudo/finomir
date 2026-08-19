import uuid
from decimal import Decimal

import pytest
from pydantic import ValidationError
from sqlalchemy.dialects import postgresql

from app.api.routes import ExpenseBulkTagsIn, bulk_update_expense_tags
from app.models import AuditLog, Expense, Tag
from app.repositories.expenses import ExpenseFilters, ExpenseRepository


class Result:
    def __init__(self, items): self.items = items
    def unique(self): return self
    def all(self): return self.items


class RepositoryDb:
    def __init__(self): self.query = None
    def scalar(self, _): return 73
    def scalars(self, query): self.query = query; return Result([])


def test_expenses_without_filters_keep_default_pagination():
    db = RepositoryDb()
    items, total = ExpenseRepository(db).list(1, 25)
    sql = str(db.query.compile(dialect=postgresql.dialect()))
    assert items == [] and total == 73
    assert "LIMIT" in sql and "OFFSET" in sql
    assert "expenses.expense_year DESC" in sql and "expenses.expense_month DESC" in sql


@pytest.mark.parametrize(("sort_by", "fragment"), [
    ("partner", "lower(partners.name)"),
    ("counterparty", "lower(counterparties.full_name)"),
    ("tags", "min(lower(tags.name))"),
    ("invoice_total", "sum(invoices.amount)"),
    ("paid_total", "sum(payments.amount)"),
    ("remaining_total", "sum(invoices.amount)"),
])
def test_expense_sorting_is_applied_before_pagination(sort_by, fragment):
    db = RepositoryDb()
    ExpenseRepository(db).list(1, 25, sort_by=sort_by, sort_order="asc")
    sql = str(db.query.compile(dialect=postgresql.dialect()))
    assert fragment in sql and " ASC" in sql
    assert sql.index("ORDER BY") < sql.index("LIMIT")


def test_select_all_expense_ids_uses_filters_without_pagination():
    db = RepositoryDb()
    ids = ExpenseRepository(db).ids(ExpenseFilters(search="реклама", tag_ids=(uuid.uuid4(),)))
    sql = str(db.query.compile(dialect=postgresql.dialect()))
    assert ids == []
    assert "expense_tags" in sql
    assert "LIMIT" not in sql and "OFFSET" not in sql


def test_all_expense_filters_are_applied_before_pagination():
    db = RepositoryDb()
    filters = ExpenseFilters(
        search="реклама", expense_month=8, expense_year=2026, payment_status="unpaid",
        partner_ids=(uuid.uuid4(), uuid.uuid4()), counterparty_ids=(uuid.uuid4(),), store_ids=(uuid.uuid4(),), tag_ids=(uuid.uuid4(),),
        amount_from=Decimal("10000"), amount_to=Decimal("50000"), invoice_document="yes", closing_document="no",
    )

    items, total = ExpenseRepository(db).list(2, 25, filters)
    sql = str(db.query.compile(dialect=postgresql.dialect()))

    assert items == [] and total == 73
    assert "expenses.partner_id" in sql and "expenses.counterparty_id" in sql
    assert "expense_store_allocations" in sql and "expense_tags" in sql
    assert sql.count("sum(invoices.amount)") >= 2
    assert "documents.document_type" in sql and "NOT IN" in sql
    assert "expenses.expense_month" in sql and "expenses.expense_year" in sql
    assert "LIMIT" in sql and "OFFSET" in sql


@pytest.mark.parametrize(("field", "value", "fragment"), [
    ("partner_ids", (uuid.uuid4(), uuid.uuid4()), "expenses.partner_id"),
    ("counterparty_ids", (uuid.uuid4(),), "expenses.counterparty_id"),
    ("store_ids", (uuid.uuid4(),), "expense_store_allocations"),
    ("tag_ids", (uuid.uuid4(),), "expense_tags"),
    ("amount_from", Decimal("10"), "sum(invoices.amount)"),
    ("amount_to", Decimal("50"), "sum(invoices.amount)"),
    ("invoice_document", "yes", "documents.document_type"),
    ("invoice_document", "cash", "invoices.invoice_number"),
    ("closing_document", "no", "documents.document_type"),
])
def test_individual_expense_filter(field, value, fragment):
    db = RepositoryDb()
    ExpenseRepository(db).list(1, 25, ExpenseFilters(**{field: value}))
    assert fragment in str(db.query.compile(dialect=postgresql.dialect()))


class BulkDb:
    def __init__(self, expenses, tags): self.expenses = expenses; self.tags = tags; self.added = []; self.committed = False
    def scalars(self, query):
        entity = query.column_descriptions[0].get("entity")
        return Result(self.expenses if entity is Expense else self.tags)
    def add(self, item): self.added.append(item)
    def commit(self): self.committed = True


def tag(name): return Tag(id=uuid.uuid4(), name=name)
def expense(*tags): return Expense(id=uuid.uuid4(), tags=list(tags))


@pytest.mark.parametrize(("action", "initial", "selected", "expected"), [
    ("add", ["старый"], ["новый"], {"старый", "новый"}),
    ("remove", ["старый", "новый"], ["новый"], {"старый"}),
    ("replace", ["старый"], ["новый"], {"новый"}),
])
def test_bulk_tags_actions(action, initial, selected, expected):
    known = {name: tag(name) for name in {"старый", "новый"}}
    item = expense(*(known[name] for name in initial)); selected_tags = [known[name] for name in selected]
    db = BulkDb([item], selected_tags)

    result = bulk_update_expense_tags(ExpenseBulkTagsIn(expense_ids=[item.id], tag_ids=[x.id for x in selected_tags], action=action), db)

    assert result == {"updated": 1} and {x.name for x in item.tags} == expected and db.committed
    audit = next(x for x in db.added if isinstance(x, AuditLog))
    assert audit.metadata_["source"] == "bulk" and audit.metadata_["action"] == action


def test_bulk_tags_rejects_missing_expense_or_tag():
    expense_id, tag_id = uuid.uuid4(), uuid.uuid4()
    with pytest.raises(Exception) as missing_expense:
        bulk_update_expense_tags(ExpenseBulkTagsIn(expense_ids=[expense_id], tag_ids=[], action="add"), BulkDb([], []))
    assert missing_expense.value.status_code == 404
    with pytest.raises(Exception) as missing_tag:
        bulk_update_expense_tags(ExpenseBulkTagsIn(expense_ids=[expense_id], tag_ids=[tag_id], action="add"), BulkDb([expense()], []))
    assert missing_tag.value.status_code == 422


def test_bulk_tags_validates_uuid_and_action():
    with pytest.raises(ValidationError): ExpenseBulkTagsIn.model_validate({"expense_ids": ["bad"], "tag_ids": [], "action": "add"})
    with pytest.raises(ValidationError): ExpenseBulkTagsIn.model_validate({"expense_ids": [str(uuid.uuid4())], "tag_ids": [], "action": "merge"})
