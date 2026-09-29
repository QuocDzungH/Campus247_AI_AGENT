"""Convert PostgreSQL json payload columns to jsonb.

Revision ID: 20260929_0002
Revises: 20260929_0001
Create Date: 2026-09-29

Existing databases that applied 20260929_0001 with sa.JSON() have json
columns. Fresh installs already get jsonb from 0001; this ALTER is a no-op
when the column is already jsonb.
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260929_0002"
down_revision: str | None = "20260929_0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

JSON_COLUMNS: tuple[tuple[str, str], ...] = (
    ("idempotency_records", "response_json"),
    ("tickets", "priority_reasons"),
    ("tickets", "request_data"),
    ("handover_packets", "source_message_ids"),
    ("officer_briefs", "facts"),
    ("officer_briefs", "missing_items"),
    ("officer_briefs", "checklist"),
    ("officer_briefs", "priority_reasons"),
    ("officer_briefs", "citations"),
    ("officer_briefs", "warnings"),
    ("officer_briefs", "error"),
    ("previews", "missing_fields"),
    ("previews", "invalid_fields"),
    ("intake_packets", "fields"),
    ("preview_revisions", "missing_fields"),
    ("preview_revisions", "invalid_fields"),
    ("safety_decisions", "source_message_ids"),
)


def upgrade() -> None:
    if op.get_bind().dialect.name != "postgresql":
        return
    for table, column in JSON_COLUMNS:
        op.execute(sa.text(f"ALTER TABLE {table} ALTER COLUMN {column} TYPE jsonb USING {column}::jsonb"))


def downgrade() -> None:
    if op.get_bind().dialect.name != "postgresql":
        return
    for table, column in JSON_COLUMNS:
        op.execute(sa.text(f"ALTER TABLE {table} ALTER COLUMN {column} TYPE json USING {column}::json"))
