"""Add password credentials, account status, and identity fields.

Revision ID: 20261003_0003
Revises: 20260929_0002
Create Date: 2026-10-03
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20261003_0003"
down_revision: str | None = "20260929_0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("users") as batch:
        batch.drop_constraint("role", type_="check")
        batch.add_column(sa.Column("username", sa.String(length=128), nullable=True))
        batch.add_column(sa.Column("email", sa.String(length=320), nullable=True))
        batch.add_column(sa.Column("password_hash", sa.Text(), nullable=True))
        batch.add_column(
            sa.Column("account_status", sa.String(length=16), nullable=False, server_default="active")
        )
        batch.add_column(sa.Column("password_changed_at", sa.DateTime(timezone=True), nullable=True))
        batch.add_column(sa.Column("failed_login_count", sa.Integer(), nullable=False, server_default="0"))
        batch.add_column(sa.Column("locked_until", sa.DateTime(timezone=True), nullable=True))
        batch.create_check_constraint("role", "role IN ('student','officer','admin')")
        batch.create_check_constraint("account_status", "account_status IN ('active','disabled')")
        batch.create_unique_constraint("uq_users_username", ["username"])
        batch.create_unique_constraint("uq_users_email", ["email"])

    with op.batch_alter_table("users") as batch:
        batch.alter_column("account_status", server_default=None)
        batch.alter_column("failed_login_count", server_default=None)

    with op.batch_alter_table("student_profiles") as batch:
        batch.add_column(sa.Column("email", sa.String(length=320), nullable=True))
        batch.add_column(sa.Column("major", sa.String(length=1000), nullable=True))
        batch.add_column(sa.Column("class_year", sa.String(length=128), nullable=True))
        batch.add_column(sa.Column("student_status", sa.String(length=128), nullable=True))
        batch.add_column(
            sa.Column(
                "verification_status",
                sa.String(length=32),
                nullable=False,
                server_default="unverified",
            )
        )
        batch.add_column(sa.Column("source", sa.String(length=300), nullable=True))
        batch.add_column(sa.Column("source_imported_at", sa.DateTime(timezone=True), nullable=True))
        batch.add_column(sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True))
        batch.add_column(sa.Column("verified_by", sa.String(length=128), nullable=True))
        batch.create_check_constraint(
            "verification_status",
            "verification_status IN ('unverified','imported','officer_verified')",
        )
        batch.create_unique_constraint("uq_student_profiles_mssv", ["mssv"])
        batch.create_foreign_key(
            "fk_student_profiles_verified_by_users",
            "users",
            ["verified_by"],
            ["id"],
        )

    with op.batch_alter_table("student_profiles") as batch:
        batch.alter_column("verification_status", server_default=None)

    with op.batch_alter_table("sessions") as batch:
        batch.add_column(sa.Column("remember", sa.Boolean(), nullable=False, server_default=sa.false()))
        batch.add_column(sa.Column("revoked_reason", sa.String(length=64), nullable=True))

    with op.batch_alter_table("sessions") as batch:
        batch.alter_column("remember", server_default=None)

    op.create_table(
        "auth_events",
        sa.Column("id", sa.String(length=128), nullable=False),
        sa.Column("event", sa.String(length=64), nullable=False),
        sa.Column("actor_id", sa.String(length=128), nullable=True),
        sa.Column("target_user_id", sa.String(length=128), nullable=True),
        sa.Column("identifier_fingerprint", sa.String(length=64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["actor_id"], ["users.id"], name=op.f("fk_auth_events_actor_id_users")),
        sa.ForeignKeyConstraint(["target_user_id"], ["users.id"], name=op.f("fk_auth_events_target_user_id_users")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_auth_events")),
    )
    op.create_index("ix_auth_events_created", "auth_events", ["created_at"], unique=False)

    op.create_table(
        "login_throttles",
        sa.Column("identifier_fingerprint", sa.String(length=64), nullable=False),
        sa.Column("failed_count", sa.Integer(), nullable=False),
        sa.Column("window_started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("locked_until", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("identifier_fingerprint", name=op.f("pk_login_throttles")),
    )

    op.create_table(
        "password_reset_tokens",
        sa.Column("id", sa.String(length=128), nullable=False),
        sa.Column("user_id", sa.String(length=128), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", sa.String(length=128), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name=op.f("fk_password_reset_tokens_user_id_users")),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], name=op.f("fk_password_reset_tokens_created_by_users")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_password_reset_tokens")),
        sa.UniqueConstraint("token_hash", name=op.f("uq_password_reset_tokens_token_hash")),
    )
    op.create_index(
        op.f("ix_password_reset_tokens_user_id"), "password_reset_tokens", ["user_id"], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_password_reset_tokens_user_id"), table_name="password_reset_tokens")
    op.drop_table("password_reset_tokens")
    op.drop_table("login_throttles")
    op.drop_index("ix_auth_events_created", table_name="auth_events")
    op.drop_table("auth_events")

    with op.batch_alter_table("sessions") as batch:
        batch.drop_column("revoked_reason")
        batch.drop_column("remember")

    with op.batch_alter_table("student_profiles") as batch:
        batch.drop_constraint("fk_student_profiles_verified_by_users", type_="foreignkey")
        batch.drop_constraint("uq_student_profiles_mssv", type_="unique")
        batch.drop_constraint("verification_status", type_="check")
        batch.drop_column("verified_by")
        batch.drop_column("verified_at")
        batch.drop_column("source_imported_at")
        batch.drop_column("source")
        batch.drop_column("verification_status")
        batch.drop_column("student_status")
        batch.drop_column("class_year")
        batch.drop_column("major")
        batch.drop_column("email")

    with op.batch_alter_table("users") as batch:
        batch.drop_constraint("uq_users_email", type_="unique")
        batch.drop_constraint("uq_users_username", type_="unique")
        batch.drop_constraint("account_status", type_="check")
        batch.drop_constraint("role", type_="check")
        batch.drop_column("locked_until")
        batch.drop_column("failed_login_count")
        batch.drop_column("password_changed_at")
        batch.drop_column("account_status")
        batch.drop_column("password_hash")
        batch.drop_column("email")
        batch.drop_column("username")
        batch.create_check_constraint("role", "role IN ('student','officer')")
