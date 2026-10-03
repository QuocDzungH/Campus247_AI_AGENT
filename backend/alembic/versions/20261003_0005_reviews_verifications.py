"""Review cases and ticket system verifications.

Revision ID: 20261003_0005
Revises: 20261003_0004
Create Date: 2026-10-03
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

from alembic import op

JSON_PAYLOAD = sa.JSON().with_variant(JSONB(), "postgresql")

revision: str = "20261003_0005"
down_revision: str | None = "20261003_0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("tickets") as batch:
        batch.add_column(sa.Column("system_verifications", JSON_PAYLOAD, nullable=False, server_default="[]"))
    with op.batch_alter_table("tickets") as batch:
        batch.alter_column("system_verifications", server_default=None)

    op.create_table(
        "review_code_sequences",
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("last_value", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("year", name="pk_review_code_sequences"),
    )
    op.create_table(
        "review_cases",
        sa.Column("id", sa.String(length=128), nullable=False),
        sa.Column("code", sa.String(length=64), nullable=False),
        sa.Column("student_id", sa.String(length=128), nullable=False),
        sa.Column("officer_id", sa.String(length=128), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("payload", JSON_PAYLOAD, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "status IN ('draft','in_review','waiting_supplement','completed')",
            name="review_status",
        ),
        sa.ForeignKeyConstraint(["student_id"], ["users.id"], name="fk_review_cases_student_id_users"),
        sa.ForeignKeyConstraint(["officer_id"], ["users.id"], name="fk_review_cases_officer_id_users"),
        sa.PrimaryKeyConstraint("id", name="pk_review_cases"),
        sa.UniqueConstraint("code", name="uq_review_cases_code"),
    )
    op.create_index("ix_review_cases_student", "review_cases", ["student_id", "created_at"])
    op.create_index("ix_review_cases_officer", "review_cases", ["officer_id", "status"])


def downgrade() -> None:
    op.drop_index("ix_review_cases_officer", table_name="review_cases")
    op.drop_index("ix_review_cases_student", table_name="review_cases")
    op.drop_table("review_cases")
    op.drop_table("review_code_sequences")
    with op.batch_alter_table("tickets") as batch:
        batch.drop_column("system_verifications")
