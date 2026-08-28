"""Store presets."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "0007"
down_revision = "0006"

def upgrade():
 op.create_table("store_presets",sa.Column("id",UUID(as_uuid=True),primary_key=True),sa.Column("name",sa.String(255),nullable=False,unique=True),sa.Column("created_at",sa.DateTime(timezone=True),nullable=False),sa.Column("updated_at",sa.DateTime(timezone=True),nullable=False))
 op.create_table("store_preset_stores",sa.Column("preset_id",UUID(as_uuid=True),sa.ForeignKey("store_presets.id",ondelete="CASCADE"),primary_key=True),sa.Column("store_id",UUID(as_uuid=True),sa.ForeignKey("stores.id",ondelete="CASCADE"),primary_key=True))

def downgrade():
 op.drop_table("store_preset_stores")
 op.drop_table("store_presets")
