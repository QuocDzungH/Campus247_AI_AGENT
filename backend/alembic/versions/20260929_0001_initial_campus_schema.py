"""Initial Campus 24/7 operational schema.

Revision ID: 20260929_0001
Revises:
Create Date: 2026-09-29
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

from alembic import op

JSON_PAYLOAD = sa.JSON().with_variant(JSONB(), "postgresql")

revision: str = "20260929_0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "teams",
        sa.Column("id", sa.String(length=128), nullable=False),
        sa.Column("name", sa.String(length=300), nullable=False),
        sa.Column("is_demo", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_teams")),
    )
    op.create_table(
        "ticket_code_sequences",
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("last_value", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("year", name=op.f("pk_ticket_code_sequences")),
    )
    op.create_table(
        "users",
        sa.Column("id", sa.String(length=128), nullable=False),
        sa.Column("role", sa.String(length=16), nullable=False),
        sa.Column("name", sa.String(length=1000), nullable=False),
        sa.Column("is_demo", sa.Boolean(), nullable=False),
        sa.Column("external_subject", sa.String(length=128), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("role IN ('student','officer')", name=op.f("ck_users_role")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_users")),
        sa.UniqueConstraint("external_subject", name=op.f("uq_users_external_subject")),
    )
    op.create_table(
        "conversations",
        sa.Column("id", sa.String(length=128), nullable=False),
        sa.Column("owner_id", sa.String(length=128), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("ai_response_locked", sa.Boolean(), nullable=False),
        sa.Column("handover_status", sa.String(length=16), nullable=False),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "handover_status IN ('none','pending','failed','completed')", name=op.f("ck_conversations_handover_status")
        ),
        sa.CheckConstraint("status IN ('active','handover','closed')", name=op.f("ck_conversations_status")),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], name=op.f("fk_conversations_owner_id_users")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_conversations")),
    )
    op.create_index("ix_conversations_owner_updated", "conversations", ["owner_id", "updated_at"], unique=False)
    op.create_table(
        "idempotency_records",
        sa.Column("id", sa.String(length=128), nullable=False),
        sa.Column("actor_id", sa.String(length=128), nullable=False),
        sa.Column("operation", sa.String(length=64), nullable=False),
        sa.Column("resource_id", sa.String(length=128), nullable=False),
        sa.Column("key", sa.String(length=128), nullable=False),
        sa.Column("payload_hash", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("http_status", sa.Integer(), nullable=True),
        sa.Column("response_json", JSON_PAYLOAD, nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("status IN ('processing','completed')", name=op.f("ck_idempotency_records_status")),
        sa.ForeignKeyConstraint(["actor_id"], ["users.id"], name=op.f("fk_idempotency_records_actor_id_users")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_idempotency_records")),
        sa.UniqueConstraint("actor_id", "operation", "resource_id", "key", name="uq_idempotency_actor_op_res_key"),
    )
    op.create_index("ix_idempotency_expires", "idempotency_records", ["expires_at"], unique=False)
    op.create_table(
        "officer_team_memberships",
        sa.Column("id", sa.String(length=128), nullable=False),
        sa.Column("user_id", sa.String(length=128), nullable=False),
        sa.Column("team_id", sa.String(length=128), nullable=False),
        sa.Column("effective_from", sa.DateTime(timezone=True), nullable=False),
        sa.Column("effective_to", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["team_id"], ["teams.id"], name=op.f("fk_officer_team_memberships_team_id_teams")),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name=op.f("fk_officer_team_memberships_user_id_users")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_officer_team_memberships")),
        sa.UniqueConstraint("user_id", "team_id", name="uq_membership_user_team"),
    )
    op.create_table(
        "sessions",
        sa.Column("id", sa.String(length=128), nullable=False),
        sa.Column("user_id", sa.String(length=128), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name=op.f("fk_sessions_user_id_users")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_sessions")),
        sa.UniqueConstraint("token_hash", name=op.f("uq_sessions_token_hash")),
    )
    op.create_index(op.f("ix_sessions_expires_at"), "sessions", ["expires_at"], unique=False)
    op.create_index(op.f("ix_sessions_user_id"), "sessions", ["user_id"], unique=False)
    op.create_table(
        "student_profiles",
        sa.Column("user_id", sa.String(length=128), nullable=False),
        sa.Column("full_name", sa.String(length=1000), nullable=True),
        sa.Column("mssv", sa.String(length=128), nullable=True),
        sa.Column("faculty", sa.String(length=1000), nullable=True),
        sa.Column("cohort", sa.String(length=1000), nullable=True),
        sa.Column("is_demo", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name=op.f("fk_student_profiles_user_id_users")),
        sa.PrimaryKeyConstraint("user_id", name=op.f("pk_student_profiles")),
    )
    op.create_table(
        "tickets",
        sa.Column("id", sa.String(length=128), nullable=False),
        sa.Column("code", sa.String(length=64), nullable=False),
        sa.Column("conversation_id", sa.String(length=128), nullable=False),
        sa.Column("student_id", sa.String(length=128), nullable=False),
        sa.Column("team_id", sa.String(length=128), nullable=False),
        sa.Column("assigned_officer_id", sa.String(length=128), nullable=True),
        sa.Column("category", sa.String(length=16), nullable=False),
        sa.Column("service_type", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("priority", sa.String(length=16), nullable=False),
        sa.Column("priority_reasons", JSON_PAYLOAD, nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("request_data", JSON_PAYLOAD, nullable=True),
        sa.Column("handover_reason", sa.Text(), nullable=True),
        sa.Column("officer_draft", sa.Text(), nullable=True),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("category IN ('action','complaint')", name=op.f("ck_tickets_category")),
        sa.CheckConstraint("priority IN ('normal','high')", name=op.f("ck_tickets_priority")),
        sa.CheckConstraint(
            "service_type IN ('student_certificate','academic_complaint','student_support')",
            name=op.f("ck_tickets_service_type"),
        ),
        sa.CheckConstraint("status IN ('open','pending_officer','resolved')", name=op.f("ck_tickets_status")),
        sa.ForeignKeyConstraint(
            ["assigned_officer_id"], ["users.id"], name=op.f("fk_tickets_assigned_officer_id_users")
        ),
        sa.ForeignKeyConstraint(
            ["conversation_id"], ["conversations.id"], name=op.f("fk_tickets_conversation_id_conversations")
        ),
        sa.ForeignKeyConstraint(["student_id"], ["users.id"], name=op.f("fk_tickets_student_id_users")),
        sa.ForeignKeyConstraint(["team_id"], ["teams.id"], name=op.f("fk_tickets_team_id_teams")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_tickets")),
        sa.UniqueConstraint("code", name=op.f("uq_tickets_code")),
        sa.UniqueConstraint("conversation_id", name=op.f("uq_tickets_conversation_id")),
    )
    op.create_index("ix_tickets_assignee", "tickets", ["assigned_officer_id"], unique=False)
    op.create_index("ix_tickets_student_created", "tickets", ["student_id", "created_at"], unique=False)
    op.create_index(
        "ix_tickets_team_status_priority_created",
        "tickets",
        ["team_id", "status", "priority", "created_at"],
        unique=False,
    )
    op.create_table(
        "audit_entries",
        sa.Column("id", sa.String(length=128), nullable=False),
        sa.Column("ticket_id", sa.String(length=128), nullable=False),
        sa.Column("actor_id", sa.String(length=128), nullable=True),
        sa.Column("actor_type", sa.String(length=16), nullable=False),
        sa.Column("action", sa.String(length=32), nullable=False),
        sa.Column("from_status", sa.String(length=32), nullable=True),
        sa.Column("to_status", sa.String(length=32), nullable=True),
        sa.Column("request_id", sa.String(length=128), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["actor_id"], ["users.id"], name=op.f("fk_audit_entries_actor_id_users")),
        sa.ForeignKeyConstraint(["ticket_id"], ["tickets.id"], name=op.f("fk_audit_entries_ticket_id_tickets")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_audit_entries")),
    )
    op.create_index("ix_audit_ticket_created", "audit_entries", ["ticket_id", "created_at"], unique=False)
    op.create_table(
        "handover_packets",
        sa.Column("id", sa.String(length=128), nullable=False),
        sa.Column("ticket_id", sa.String(length=128), nullable=False),
        sa.Column("risk_type", sa.String(length=64), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("source_message_ids", JSON_PAYLOAD, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["ticket_id"], ["tickets.id"], name=op.f("fk_handover_packets_ticket_id_tickets")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_handover_packets")),
    )
    op.create_index(op.f("ix_handover_packets_ticket_id"), "handover_packets", ["ticket_id"], unique=False)
    op.create_table(
        "jobs",
        sa.Column("id", sa.String(length=128), nullable=False),
        sa.Column("kind", sa.String(length=32), nullable=False),
        sa.Column("ticket_id", sa.String(length=128), nullable=True),
        sa.Column("conversation_id", sa.String(length=128), nullable=True),
        sa.Column("operation_id", sa.String(length=128), nullable=True),
        sa.Column("source_revision", sa.Integer(), nullable=True),
        sa.Column("state", sa.String(length=16), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.Column("available_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("lease_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("kind IN ('prepare_brief','retry_handover')", name=op.f("ck_jobs_kind")),
        sa.CheckConstraint(
            "state IN ('pending','leased','succeeded','failed','cancelled')", name=op.f("ck_jobs_state")
        ),
        sa.ForeignKeyConstraint(
            ["conversation_id"], ["conversations.id"], name=op.f("fk_jobs_conversation_id_conversations")
        ),
        sa.ForeignKeyConstraint(["ticket_id"], ["tickets.id"], name=op.f("fk_jobs_ticket_id_tickets")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_jobs")),
    )
    op.create_index("ix_jobs_lease_until", "jobs", ["lease_until"], unique=False)
    op.create_index("ix_jobs_state_available", "jobs", ["state", "available_at"], unique=False)
    op.create_index(
        "uq_jobs_prepare_brief_revision",
        "jobs",
        ["kind", "ticket_id", "source_revision"],
        unique=True,
        sqlite_where=sa.text("kind = 'prepare_brief' AND ticket_id IS NOT NULL AND source_revision IS NOT NULL"),
        postgresql_where=sa.text("kind = 'prepare_brief' AND ticket_id IS NOT NULL AND source_revision IS NOT NULL"),
    )
    op.create_index(
        "uq_jobs_retry_handover_operation",
        "jobs",
        ["kind", "operation_id"],
        unique=True,
        sqlite_where=sa.text("kind = 'retry_handover' AND operation_id IS NOT NULL"),
        postgresql_where=sa.text("kind = 'retry_handover' AND operation_id IS NOT NULL"),
    )
    op.create_table(
        "messages",
        sa.Column("id", sa.String(length=128), nullable=False),
        sa.Column("conversation_id", sa.String(length=128), nullable=False),
        sa.Column("ticket_id", sa.String(length=128), nullable=True),
        sa.Column("sender", sa.String(length=16), nullable=False),
        sa.Column("sender_user_id", sa.String(length=128), nullable=True),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("seq", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("sender IN ('student','officer','assistant','system')", name=op.f("ck_messages_sender")),
        sa.ForeignKeyConstraint(
            ["conversation_id"], ["conversations.id"], name=op.f("fk_messages_conversation_id_conversations")
        ),
        sa.ForeignKeyConstraint(["sender_user_id"], ["users.id"], name=op.f("fk_messages_sender_user_id_users")),
        sa.ForeignKeyConstraint(["ticket_id"], ["tickets.id"], name=op.f("fk_messages_ticket_id_tickets")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_messages")),
        sa.UniqueConstraint("conversation_id", "seq", name="uq_messages_conversation_seq"),
    )
    op.create_index(
        "ix_messages_conversation_created", "messages", ["conversation_id", "created_at", "id"], unique=False
    )
    op.create_index("ix_messages_ticket_created", "messages", ["ticket_id", "created_at"], unique=False)
    op.create_table(
        "officer_actions",
        sa.Column("id", sa.String(length=128), nullable=False),
        sa.Column("ticket_id", sa.String(length=128), nullable=False),
        sa.Column("actor_id", sa.String(length=128), nullable=False),
        sa.Column("action", sa.String(length=32), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("expected_revision", sa.Integer(), nullable=False),
        sa.Column("reviewed_brief_version", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("action IN ('respond','request_info','resolve')", name=op.f("ck_officer_actions_action")),
        sa.ForeignKeyConstraint(["actor_id"], ["users.id"], name=op.f("fk_officer_actions_actor_id_users")),
        sa.ForeignKeyConstraint(["ticket_id"], ["tickets.id"], name=op.f("fk_officer_actions_ticket_id_tickets")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_officer_actions")),
    )
    op.create_index(op.f("ix_officer_actions_ticket_id"), "officer_actions", ["ticket_id"], unique=False)
    op.create_table(
        "officer_briefs",
        sa.Column("id", sa.String(length=128), nullable=False),
        sa.Column("ticket_id", sa.String(length=128), nullable=False),
        sa.Column("brief_version", sa.Integer(), nullable=False),
        sa.Column("source_ticket_revision", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("quality_status", sa.String(length=16), nullable=True),
        sa.Column("is_current", sa.Boolean(), nullable=False),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("facts", JSON_PAYLOAD, nullable=True),
        sa.Column("missing_items", JSON_PAYLOAD, nullable=True),
        sa.Column("checklist", JSON_PAYLOAD, nullable=True),
        sa.Column("suggested_priority", sa.String(length=16), nullable=True),
        sa.Column("priority_reasons", JSON_PAYLOAD, nullable=True),
        sa.Column("draft_reply", sa.Text(), nullable=True),
        sa.Column("citations", JSON_PAYLOAD, nullable=True),
        sa.Column("warnings", JSON_PAYLOAD, nullable=True),
        sa.Column("model_name", sa.String(length=128), nullable=True),
        sa.Column("prompt_version", sa.String(length=128), nullable=True),
        sa.Column("template_version", sa.String(length=128), nullable=True),
        sa.Column("index_version", sa.String(length=128), nullable=True),
        sa.Column("error", JSON_PAYLOAD, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "status IN ('pending','processing','ready','failed','stale')", name=op.f("ck_officer_briefs_status")
        ),
        sa.ForeignKeyConstraint(["ticket_id"], ["tickets.id"], name=op.f("fk_officer_briefs_ticket_id_tickets")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_officer_briefs")),
        sa.UniqueConstraint("ticket_id", "brief_version", name="uq_officer_briefs_version"),
    )
    op.create_index("ix_officer_briefs_ticket_current", "officer_briefs", ["ticket_id", "is_current"], unique=False)
    op.create_table(
        "previews",
        sa.Column("id", sa.String(length=128), nullable=False),
        sa.Column("conversation_id", sa.String(length=128), nullable=False),
        sa.Column("owner_id", sa.String(length=128), nullable=False),
        sa.Column("service_type", sa.String(length=64), nullable=False),
        sa.Column("purpose", sa.Text(), nullable=True),
        sa.Column("destination_org", sa.String(length=300), nullable=True),
        sa.Column("receive_method", sa.String(length=32), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("missing_fields", JSON_PAYLOAD, nullable=False),
        sa.Column("invalid_fields", JSON_PAYLOAD, nullable=False),
        sa.Column("consumed_ticket_id", sa.String(length=128), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("status IN ('active','consumed','invalidated')", name=op.f("ck_previews_status")),
        sa.ForeignKeyConstraint(
            ["consumed_ticket_id"], ["tickets.id"], name=op.f("fk_previews_consumed_ticket_id_tickets")
        ),
        sa.ForeignKeyConstraint(
            ["conversation_id"], ["conversations.id"], name=op.f("fk_previews_conversation_id_conversations")
        ),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], name=op.f("fk_previews_owner_id_users")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_previews")),
    )
    op.create_index(op.f("ix_previews_conversation_id"), "previews", ["conversation_id"], unique=False)
    op.create_index(op.f("ix_previews_owner_id"), "previews", ["owner_id"], unique=False)
    op.create_table(
        "ticket_assignments",
        sa.Column("id", sa.String(length=128), nullable=False),
        sa.Column("ticket_id", sa.String(length=128), nullable=False),
        sa.Column("team_id", sa.String(length=128), nullable=False),
        sa.Column("officer_id", sa.String(length=128), nullable=True),
        sa.Column("previous_officer_id", sa.String(length=128), nullable=True),
        sa.Column("assigned_by", sa.String(length=128), nullable=False),
        sa.Column("action", sa.String(length=16), nullable=False),
        sa.Column("assigned_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("is_demo", sa.Boolean(), nullable=False),
        sa.CheckConstraint("action IN ('claim','transfer','release')", name=op.f("ck_ticket_assignments_action")),
        sa.ForeignKeyConstraint(["assigned_by"], ["users.id"], name=op.f("fk_ticket_assignments_assigned_by_users")),
        sa.ForeignKeyConstraint(["officer_id"], ["users.id"], name=op.f("fk_ticket_assignments_officer_id_users")),
        sa.ForeignKeyConstraint(
            ["previous_officer_id"], ["users.id"], name=op.f("fk_ticket_assignments_previous_officer_id_users")
        ),
        sa.ForeignKeyConstraint(["team_id"], ["teams.id"], name=op.f("fk_ticket_assignments_team_id_teams")),
        sa.ForeignKeyConstraint(["ticket_id"], ["tickets.id"], name=op.f("fk_ticket_assignments_ticket_id_tickets")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_ticket_assignments")),
    )
    op.create_index(op.f("ix_ticket_assignments_ticket_id"), "ticket_assignments", ["ticket_id"], unique=False)
    op.create_table(
        "fact_provenance",
        sa.Column("id", sa.String(length=128), nullable=False),
        sa.Column("brief_id", sa.String(length=128), nullable=False),
        sa.Column("key", sa.String(length=128), nullable=False),
        sa.Column("value", sa.Text(), nullable=False),
        sa.Column("source_type", sa.String(length=32), nullable=False),
        sa.Column("source_id", sa.String(length=128), nullable=False),
        sa.Column("verification_status", sa.String(length=16), nullable=False),
        sa.CheckConstraint(
            "source_type IN ('student_message','profile','policy','tool_result')",
            name=op.f("ck_fact_provenance_source_type"),
        ),
        sa.CheckConstraint(
            "verification_status IN ('unverified','verified','disputed')", name=op.f("ck_fact_provenance_verification")
        ),
        sa.ForeignKeyConstraint(
            ["brief_id"], ["officer_briefs.id"], name=op.f("fk_fact_provenance_brief_id_officer_briefs")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_fact_provenance")),
    )
    op.create_index(op.f("ix_fact_provenance_brief_id"), "fact_provenance", ["brief_id"], unique=False)
    op.create_table(
        "intake_operations",
        sa.Column("id", sa.String(length=128), nullable=False),
        sa.Column("conversation_id", sa.String(length=128), nullable=False),
        sa.Column("actor_id", sa.String(length=128), nullable=False),
        sa.Column("request_id", sa.String(length=128), nullable=False),
        sa.Column("idempotency_key", sa.String(length=128), nullable=True),
        sa.Column("state", sa.String(length=32), nullable=False),
        sa.Column("user_message_id", sa.String(length=128), nullable=True),
        sa.Column("route", sa.String(length=8), nullable=True),
        sa.Column("outcome", sa.String(length=64), nullable=True),
        sa.Column("payload_hash", sa.String(length=64), nullable=True),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "state IN ('processing','completed','retryable_failed','terminal_failed')",
            name=op.f("ck_intake_operations_state"),
        ),
        sa.ForeignKeyConstraint(["actor_id"], ["users.id"], name=op.f("fk_intake_operations_actor_id_users")),
        sa.ForeignKeyConstraint(
            ["conversation_id"], ["conversations.id"], name=op.f("fk_intake_operations_conversation_id_conversations")
        ),
        sa.ForeignKeyConstraint(
            ["user_message_id"], ["messages.id"], name=op.f("fk_intake_operations_user_message_id_messages")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_intake_operations")),
    )
    op.create_index(
        op.f("ix_intake_operations_conversation_id"), "intake_operations", ["conversation_id"], unique=False
    )
    op.create_index(
        "uq_intake_ops_processing",
        "intake_operations",
        ["conversation_id"],
        unique=True,
        sqlite_where=sa.text("state = 'processing'"),
        postgresql_where=sa.text("state = 'processing'"),
    )
    op.create_table(
        "intake_packets",
        sa.Column("id", sa.String(length=128), nullable=False),
        sa.Column("ticket_id", sa.String(length=128), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("service_type", sa.String(length=64), nullable=False),
        sa.Column("fields", JSON_PAYLOAD, nullable=False),
        sa.Column("source_message_id", sa.String(length=128), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["source_message_id"], ["messages.id"], name=op.f("fk_intake_packets_source_message_id_messages")
        ),
        sa.ForeignKeyConstraint(["ticket_id"], ["tickets.id"], name=op.f("fk_intake_packets_ticket_id_tickets")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_intake_packets")),
    )
    op.create_index(op.f("ix_intake_packets_ticket_id"), "intake_packets", ["ticket_id"], unique=False)
    op.create_table(
        "message_citations",
        sa.Column("id", sa.String(length=128), nullable=False),
        sa.Column("message_id", sa.String(length=128), nullable=False),
        sa.Column("document_id", sa.String(length=128), nullable=False),
        sa.Column("document_title", sa.String(length=1000), nullable=False),
        sa.Column("document_version", sa.String(length=128), nullable=False),
        sa.Column("chunk_id", sa.String(length=128), nullable=False),
        sa.Column("locator", sa.String(length=1000), nullable=False),
        sa.Column("quote", sa.Text(), nullable=False),
        sa.Column("url", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["message_id"], ["messages.id"], name=op.f("fk_message_citations_message_id_messages")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_message_citations")),
    )
    op.create_index(op.f("ix_message_citations_message_id"), "message_citations", ["message_id"], unique=False)
    op.create_table(
        "preview_revisions",
        sa.Column("id", sa.String(length=128), nullable=False),
        sa.Column("preview_id", sa.String(length=128), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("purpose", sa.Text(), nullable=True),
        sa.Column("destination_org", sa.String(length=300), nullable=True),
        sa.Column("receive_method", sa.String(length=32), nullable=True),
        sa.Column("missing_fields", JSON_PAYLOAD, nullable=False),
        sa.Column("invalid_fields", JSON_PAYLOAD, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["preview_id"], ["previews.id"], name=op.f("fk_preview_revisions_preview_id_previews")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_preview_revisions")),
        sa.UniqueConstraint("preview_id", "version", name="uq_preview_revisions_version"),
    )
    op.create_table(
        "ticket_attachments",
        sa.Column("id", sa.String(length=128), nullable=False),
        sa.Column("ticket_id", sa.String(length=128), nullable=False),
        sa.Column("message_id", sa.String(length=128), nullable=True),
        sa.Column("filename", sa.String(length=500), nullable=False),
        sa.Column("mime_type", sa.String(length=200), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("object_key", sa.String(length=1000), nullable=True),
        sa.Column("uploader_id", sa.String(length=128), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["message_id"], ["messages.id"], name=op.f("fk_ticket_attachments_message_id_messages")
        ),
        sa.ForeignKeyConstraint(["ticket_id"], ["tickets.id"], name=op.f("fk_ticket_attachments_ticket_id_tickets")),
        sa.ForeignKeyConstraint(["uploader_id"], ["users.id"], name=op.f("fk_ticket_attachments_uploader_id_users")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_ticket_attachments")),
    )
    op.create_index(op.f("ix_ticket_attachments_ticket_id"), "ticket_attachments", ["ticket_id"], unique=False)
    op.create_table(
        "safety_decisions",
        sa.Column("id", sa.String(length=128), nullable=False),
        sa.Column("conversation_id", sa.String(length=128), nullable=False),
        sa.Column("operation_id", sa.String(length=128), nullable=False),
        sa.Column("message_id", sa.String(length=128), nullable=False),
        sa.Column("risk_type", sa.String(length=64), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("source_message_ids", JSON_PAYLOAD, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["conversation_id"], ["conversations.id"], name=op.f("fk_safety_decisions_conversation_id_conversations")
        ),
        sa.ForeignKeyConstraint(["message_id"], ["messages.id"], name=op.f("fk_safety_decisions_message_id_messages")),
        sa.ForeignKeyConstraint(
            ["operation_id"], ["intake_operations.id"], name=op.f("fk_safety_decisions_operation_id_intake_operations")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_safety_decisions")),
        sa.UniqueConstraint("operation_id", name=op.f("uq_safety_decisions_operation_id")),
    )
    op.create_index(op.f("ix_safety_decisions_conversation_id"), "safety_decisions", ["conversation_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_safety_decisions_conversation_id"), table_name="safety_decisions")
    op.drop_table("safety_decisions")
    op.drop_index(op.f("ix_ticket_attachments_ticket_id"), table_name="ticket_attachments")
    op.drop_table("ticket_attachments")
    op.drop_table("preview_revisions")
    op.drop_index(op.f("ix_message_citations_message_id"), table_name="message_citations")
    op.drop_table("message_citations")
    op.drop_index(op.f("ix_intake_packets_ticket_id"), table_name="intake_packets")
    op.drop_table("intake_packets")
    op.drop_index(
        "uq_intake_ops_processing",
        table_name="intake_operations",
        sqlite_where=sa.text("state = 'processing'"),
        postgresql_where=sa.text("state = 'processing'"),
    )
    op.drop_index(op.f("ix_intake_operations_conversation_id"), table_name="intake_operations")
    op.drop_table("intake_operations")
    op.drop_index(op.f("ix_fact_provenance_brief_id"), table_name="fact_provenance")
    op.drop_table("fact_provenance")
    op.drop_index(op.f("ix_ticket_assignments_ticket_id"), table_name="ticket_assignments")
    op.drop_table("ticket_assignments")
    op.drop_index(op.f("ix_previews_owner_id"), table_name="previews")
    op.drop_index(op.f("ix_previews_conversation_id"), table_name="previews")
    op.drop_table("previews")
    op.drop_index("ix_officer_briefs_ticket_current", table_name="officer_briefs")
    op.drop_table("officer_briefs")
    op.drop_index(op.f("ix_officer_actions_ticket_id"), table_name="officer_actions")
    op.drop_table("officer_actions")
    op.drop_index("ix_messages_ticket_created", table_name="messages")
    op.drop_index("ix_messages_conversation_created", table_name="messages")
    op.drop_table("messages")
    op.drop_index(
        "uq_jobs_retry_handover_operation",
        table_name="jobs",
        sqlite_where=sa.text("kind = 'retry_handover' AND operation_id IS NOT NULL"),
        postgresql_where=sa.text("kind = 'retry_handover' AND operation_id IS NOT NULL"),
    )
    op.drop_index(
        "uq_jobs_prepare_brief_revision",
        table_name="jobs",
        sqlite_where=sa.text("kind = 'prepare_brief' AND ticket_id IS NOT NULL AND source_revision IS NOT NULL"),
        postgresql_where=sa.text("kind = 'prepare_brief' AND ticket_id IS NOT NULL AND source_revision IS NOT NULL"),
    )
    op.drop_index("ix_jobs_state_available", table_name="jobs")
    op.drop_index("ix_jobs_lease_until", table_name="jobs")
    op.drop_table("jobs")
    op.drop_index(op.f("ix_handover_packets_ticket_id"), table_name="handover_packets")
    op.drop_table("handover_packets")
    op.drop_index("ix_audit_ticket_created", table_name="audit_entries")
    op.drop_table("audit_entries")
    op.drop_index("ix_tickets_team_status_priority_created", table_name="tickets")
    op.drop_index("ix_tickets_student_created", table_name="tickets")
    op.drop_index("ix_tickets_assignee", table_name="tickets")
    op.drop_table("tickets")
    op.drop_table("student_profiles")
    op.drop_index(op.f("ix_sessions_user_id"), table_name="sessions")
    op.drop_index(op.f("ix_sessions_expires_at"), table_name="sessions")
    op.drop_table("sessions")
    op.drop_table("officer_team_memberships")
    op.drop_index("ix_idempotency_expires", table_name="idempotency_records")
    op.drop_table("idempotency_records")
    op.drop_index("ix_conversations_owner_updated", table_name="conversations")
    op.drop_table("conversations")
    op.drop_table("users")
    op.drop_table("ticket_code_sequences")
    op.drop_table("teams")
