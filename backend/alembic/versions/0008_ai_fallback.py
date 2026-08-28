"""Настройки OpenAI и журнал резервного распознавания."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision = "0008"
down_revision = "0007"

def upgrade():
    op.create_table("ai_settings", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.false()), sa.Column("model", sa.String(100), nullable=False, server_default="gpt-4.1-mini"), sa.Column("encrypted_api_key", sa.Text()), sa.Column("connection_status", sa.String(30), nullable=False, server_default="not_checked"), sa.Column("connection_error", sa.String(500)), sa.Column("checked_at", sa.DateTime(timezone=True)), sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False))
    op.create_table("ai_fallback_logs", sa.Column("id", UUID(as_uuid=True), primary_key=True), sa.Column("document_id", UUID(as_uuid=True), sa.ForeignKey("documents.id"), nullable=False), sa.Column("expense_id", UUID(as_uuid=True), sa.ForeignKey("expenses.id")), sa.Column("missing_fields", JSONB, nullable=False), sa.Column("reason", sa.Text(), nullable=False), sa.Column("model", sa.String(100), nullable=False), sa.Column("success", sa.Boolean(), nullable=False, server_default=sa.false()), sa.Column("primary_fields", JSONB, nullable=False), sa.Column("ai_fields", JSONB, nullable=False), sa.Column("final_fields", JSONB, nullable=False), sa.Column("supplemented_fields", JSONB, nullable=False), sa.Column("duration_ms", sa.Integer(), nullable=False), sa.Column("error_code", sa.String(100)), sa.Column("error_message", sa.String(500)), sa.Column("usage", JSONB), sa.Column("request_id", sa.String(255)), sa.Column("status", sa.String(30), nullable=False, server_default="new"), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False), sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False))
    op.create_index("ix_ai_fallback_logs_document_id", "ai_fallback_logs", ["document_id"])
    op.create_index("ix_ai_fallback_logs_expense_id", "ai_fallback_logs", ["expense_id"])
    op.create_index("ix_ai_fallback_logs_status", "ai_fallback_logs", ["status"])
    op.create_index("ix_ai_fallback_logs_created_at", "ai_fallback_logs", ["created_at"])

def downgrade():
    op.drop_table("ai_fallback_logs")
    op.drop_table("ai_settings")
