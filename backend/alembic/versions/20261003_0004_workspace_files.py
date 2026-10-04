"""Officer workspace checklist JSON on tickets.

Revision ID: 20261003_0004
Revises: 20261003_0003
Create Date: 2026-10-03
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

from alembic import op

JSON_PAYLOAD = sa.JSON().with_variant(JSONB(), "postgresql")

revision: str = "20261003_0004"
down_revision: str | None = "20261003_0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("tickets") as batch:
        batch.add_column(sa.Column("officer_checklist", JSON_PAYLOAD, nullable=False, server_default="[]"))
    with op.batch_alter_table("tickets") as batch:
        batch.alter_column("officer_checklist", server_default=None)


def downgrade() -> None:
    with op.batch_alter_table("tickets") as batch:
        batch.drop_column("officer_checklist")
