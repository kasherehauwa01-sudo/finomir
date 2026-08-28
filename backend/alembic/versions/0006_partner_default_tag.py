"""Default expense tag for partners."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "0006"
down_revision = "0005"

def upgrade():
 op.add_column("partners", sa.Column("tag_id", UUID(as_uuid=True), nullable=True))
 op.create_foreign_key("fk_partners_tag_id", "partners", "tags", ["tag_id"], ["id"], ondelete="SET NULL")
 op.create_index("ix_partners_tag_id", "partners", ["tag_id"])

def downgrade():
 op.drop_index("ix_partners_tag_id", table_name="partners")
 op.drop_constraint("fk_partners_tag_id", "partners", type_="foreignkey")
 op.drop_column("partners", "tag_id")
