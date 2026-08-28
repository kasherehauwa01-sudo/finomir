"""Удаление устаревшего системного магазина «Общий маркетинг»."""
from alembic import op

revision = "0002"
down_revision = "0001"


def upgrade():
    op.execute("DELETE FROM expense_store_allocations WHERE store_id IN (SELECT id FROM stores WHERE name = 'Общий маркетинг')")
    op.execute("DELETE FROM stores WHERE name = 'Общий маркетинг'")


def downgrade():
    op.execute("INSERT INTO stores (id,name,is_active,is_system,created_at,updated_at) VALUES (gen_random_uuid(),'Общий маркетинг',true,true,now(),now()) ON CONFLICT (name) DO NOTHING")
