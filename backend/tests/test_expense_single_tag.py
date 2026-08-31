import uuid

import pytest
from pydantic import ValidationError

from app.api.routes import ExpenseIn, PartnerIn


def test_expense_rejects_more_than_one_tag():
    with pytest.raises(ValidationError):
        ExpenseIn(
            partner_id=uuid.uuid4(), counterparty_id=uuid.uuid4(),
            service_name="Услуга", expense_month=8, expense_year=2026,
            tag_ids=[uuid.uuid4(), uuid.uuid4()],
        )


def test_partner_accepts_only_one_default_tag():
    tag_id = uuid.uuid4()
    partner = PartnerIn(name="Партнер", tag_id=tag_id)

    assert partner.tag_id == tag_id
