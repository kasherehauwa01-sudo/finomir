"""Разрешить временно не привязывать контрагента к партнеру."""
from alembic import op

revision = "0004"
down_revision = "0003"


def upgrade(): op.alter_column("counterparties", "partner_id", nullable=True)
def downgrade(): op.alter_column("counterparties", "partner_id", nullable=False)
