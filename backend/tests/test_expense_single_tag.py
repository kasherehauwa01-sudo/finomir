import uuid

import pytest
from pydantic import ValidationError

from app.api.routes import ExpenseIn


def test_expense_rejects_more_than_one_tag():
    with pytest.raises(ValidationError):
        ExpenseIn(
            partner_id=uuid.uuid4(), counterparty_id=uuid.uuid4(),
            service_name="Услуга", expense_month=8, expense_year=2026,
            tag_ids=[uuid.uuid4(), uuid.uuid4()],
        )
