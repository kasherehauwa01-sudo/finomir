"""История результатов OCR для повторной обработки документов."""
from alembic import op
from sqlalchemy import Column, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision = "0003"
down_revision = "0002"


def upgrade():
    op.create_table("ocr_results", Column("id", UUID(as_uuid=True), primary_key=True), Column("document_id", UUID(as_uuid=True), ForeignKey("documents.id"), nullable=False), Column("provider", String(30), nullable=False), Column("raw_text", Text, nullable=False), Column("fields", JSONB, nullable=False), Column("confidence", JSONB, nullable=False), Column("blocks", JSONB, nullable=False), Column("created_at", DateTime(timezone=True), nullable=False))
    op.create_index("ix_ocr_results_document_id", "ocr_results", ["document_id"])


def downgrade(): op.drop_table("ocr_results")
