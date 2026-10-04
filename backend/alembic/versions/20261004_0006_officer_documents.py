"""Officer document drafts, issued artifacts, supplements, evidence fingerprint.

Revision ID: 20261004_0006
Revises: 20261003_0005
Create Date: 2026-10-04
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

from alembic import op

JSON_PAYLOAD = sa.JSON().with_variant(JSONB(), "postgresql")

revision: str = "20261004_0006"
down_revision: str | None = "20261003_0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("tickets") as batch:
        batch.add_column(sa.Column("document_draft", JSON_PAYLOAD, nullable=True))
        batch.add_column(sa.Column("supplement_requests", JSON_PAYLOAD, nullable=False, server_default="[]"))
        batch.add_column(sa.Column("evidence_fingerprint", sa.String(length=64), nullable=True))
    with op.batch_alter_table("tickets") as batch:
        batch.alter_column("supplement_requests", server_default=None)

    with op.batch_alter_table("audit_entries") as batch:
        batch.add_column(sa.Column("details", JSON_PAYLOAD, nullable=True))

    op.create_table(
        "issued_documents",
        sa.Column("id", sa.String(length=128), nullable=False),
        sa.Column("ticket_id", sa.String(length=128), nullable=False),
        sa.Column("draft_version", sa.Integer(), nullable=False),
        sa.Column("template_id", sa.String(length=128), nullable=False),
        sa.Column("template_version", sa.String(length=64), nullable=False),
        sa.Column("filename", sa.String(length=500), nullable=False),
        sa.Column("mime_type", sa.String(length=200), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("object_key", sa.String(length=1000), nullable=False),
        sa.Column("sha256", sa.String(length=64), nullable=False),
        sa.Column("payload", JSON_PAYLOAD, nullable=False),
        sa.Column("issued_by", sa.String(length=128), nullable=False),
        sa.Column("issued_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("signature_status", sa.String(length=32), nullable=False),
        sa.Column("signing_provider", sa.String(length=64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "signature_status IN ('unsigned','pending_signature','signed')",
            name="ck_issued_documents_signature_status",
        ),
        sa.ForeignKeyConstraint(["ticket_id"], ["tickets.id"], name="fk_issued_documents_ticket_id_tickets"),
        sa.ForeignKeyConstraint(["issued_by"], ["users.id"], name="fk_issued_documents_issued_by_users"),
        sa.PrimaryKeyConstraint("id", name="pk_issued_documents"),
        sa.UniqueConstraint("ticket_id", name="uq_issued_documents_ticket"),
    )


def downgrade() -> None:
    op.drop_table("issued_documents")
    with op.batch_alter_table("audit_entries") as batch:
        batch.drop_column("details")
    with op.batch_alter_table("tickets") as batch:
        batch.drop_column("evidence_fingerprint")
        batch.drop_column("supplement_requests")
        batch.drop_column("document_draft")
