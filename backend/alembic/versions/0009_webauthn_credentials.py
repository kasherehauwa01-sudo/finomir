"""Учетные данные для входа по биометрии."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "0009"
down_revision = "0008"

def upgrade():
    op.create_table("webauthn_credentials", sa.Column("id", UUID(as_uuid=True), primary_key=True), sa.Column("credential_id", sa.String(1024), nullable=False), sa.Column("public_key", sa.LargeBinary(), nullable=False), sa.Column("sign_count", sa.Integer(), nullable=False, server_default="0"), sa.Column("device_name", sa.String(200), nullable=False, server_default="Мобильное устройство"), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False), sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False))
    op.create_index("ix_webauthn_credentials_credential_id", "webauthn_credentials", ["credential_id"], unique=True)

def downgrade():
    op.drop_table("webauthn_credentials")
