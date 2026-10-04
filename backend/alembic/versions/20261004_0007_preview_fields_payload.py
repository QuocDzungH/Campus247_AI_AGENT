"""Store full intake fields on previews so complaint forms are not jammed into certificate columns.

Revision ID: 20261004_0007
Revises: 20261004_0006
Create Date: 2026-10-04
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

from alembic import op

JSON_PAYLOAD = sa.JSON().with_variant(JSONB(), "postgresql")

revision: str = "20261004_0007"
down_revision: str | None = "20261004_0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("previews") as batch:
        batch.add_column(sa.Column("fields_payload", JSON_PAYLOAD, nullable=True))
    with op.batch_alter_table("preview_revisions") as batch:
        batch.add_column(sa.Column("fields_payload", JSON_PAYLOAD, nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("preview_revisions") as batch:
        batch.drop_column("fields_payload")
    with op.batch_alter_table("previews") as batch:
        batch.drop_column("fields_payload")
