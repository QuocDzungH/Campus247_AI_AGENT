from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    ForeignKey,
    Index,
    Integer,
    MetaData,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

from campus247.db.types import PortableJSON, UTCDateTime

NAMING = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}

ID = String(128)


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING)


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint("role IN ('student','officer','admin')", name="role"),
        CheckConstraint("account_status IN ('active','disabled')", name="account_status"),
    )

    id: Mapped[str] = mapped_column(ID, primary_key=True)
    role: Mapped[str] = mapped_column(String(16), nullable=False)
    name: Mapped[str] = mapped_column(String(1000), nullable=False)
    username: Mapped[str | None] = mapped_column(String(128), unique=True)
    email: Mapped[str | None] = mapped_column(String(320), unique=True)
    password_hash: Mapped[str | None] = mapped_column(Text)
    account_status: Mapped[str] = mapped_column(String(16), nullable=False, default="active")
    password_changed_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    failed_login_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    locked_until: Mapped[datetime | None] = mapped_column(UTCDateTime)
    is_demo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    external_subject: Mapped[str | None] = mapped_column(String(128), unique=True, nullable=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime, nullable=False)

    profile: Mapped["StudentProfile | None"] = relationship(
        back_populates="user",
        foreign_keys="StudentProfile.user_id",
    )
    memberships: Mapped[list["OfficerTeamMembership"]] = relationship(back_populates="user")


class StudentProfile(Base):
    __tablename__ = "student_profiles"
    __table_args__ = (
        CheckConstraint(
            "verification_status IN ('unverified','imported','officer_verified')",
            name="verification_status",
        ),
        UniqueConstraint("mssv", name="uq_student_profiles_mssv"),
    )

    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), primary_key=True)
    full_name: Mapped[str | None] = mapped_column(String(1000))
    mssv: Mapped[str | None] = mapped_column(String(128))
    email: Mapped[str | None] = mapped_column(String(320))
    faculty: Mapped[str | None] = mapped_column(String(1000))
    major: Mapped[str | None] = mapped_column(String(1000))
    cohort: Mapped[str | None] = mapped_column(String(1000))
    class_year: Mapped[str | None] = mapped_column(String(128))
    student_status: Mapped[str | None] = mapped_column(String(128))
    verification_status: Mapped[str] = mapped_column(String(32), nullable=False, default="unverified")
    source: Mapped[str | None] = mapped_column(String(300))
    source_imported_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    verified_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    verified_by: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    is_demo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime, nullable=False)

    user: Mapped[User] = relationship(back_populates="profile", foreign_keys=[user_id])
    verifier: Mapped[User | None] = relationship(foreign_keys=[verified_by])


class Team(Base):
    __tablename__ = "teams"

    id: Mapped[str] = mapped_column(ID, primary_key=True)
    name: Mapped[str] = mapped_column(String(300), nullable=False)
    is_demo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime, nullable=False)


class OfficerTeamMembership(Base):
    __tablename__ = "officer_team_memberships"
    __table_args__ = (UniqueConstraint("user_id", "team_id", name="uq_membership_user_team"),)

    id: Mapped[str] = mapped_column(ID, primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)
    team_id: Mapped[str] = mapped_column(ForeignKey("teams.id"), nullable=False)
    effective_from: Mapped[datetime] = mapped_column(UTCDateTime, nullable=False)
    effective_to: Mapped[datetime | None] = mapped_column(UTCDateTime)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, nullable=False)

    user: Mapped[User] = relationship(back_populates="memberships")
    team: Mapped[Team] = relationship()


class SessionToken(Base):
    __tablename__ = "sessions"

    id: Mapped[str] = mapped_column(ID, primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    token_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    expires_at: Mapped[datetime] = mapped_column(UTCDateTime, nullable=False, index=True)
    revoked_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    remember: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    revoked_reason: Mapped[str | None] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, nullable=False)


class AuthEvent(Base):
    __tablename__ = "auth_events"
    __table_args__ = (Index("ix_auth_events_created", "created_at"),)

    id: Mapped[str] = mapped_column(ID, primary_key=True)
    event: Mapped[str] = mapped_column(String(64), nullable=False)
    actor_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    target_user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    identifier_fingerprint: Mapped[str | None] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, nullable=False)


class LoginThrottle(Base):
    __tablename__ = "login_throttles"

    identifier_fingerprint: Mapped[str] = mapped_column(String(64), primary_key=True)
    failed_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    window_started_at: Mapped[datetime] = mapped_column(UTCDateTime, nullable=False)
    locked_until: Mapped[datetime | None] = mapped_column(UTCDateTime)


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id: Mapped[str] = mapped_column(ID, primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    token_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    expires_at: Mapped[datetime] = mapped_column(UTCDateTime, nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    created_by: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, nullable=False)


class Conversation(Base):
    __tablename__ = "conversations"
    __table_args__ = (
        CheckConstraint("status IN ('active','handover','closed')", name="status"),
        CheckConstraint("handover_status IN ('none','pending','failed','completed')", name="handover_status"),
        Index("ix_conversations_owner_updated", "owner_id", "updated_at"),
    )

    id: Mapped[str] = mapped_column(ID, primary_key=True)
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="active")
    ai_response_locked: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    handover_status: Mapped[str] = mapped_column(String(16), nullable=False, default="none")
    revision: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime, nullable=False)

    owner: Mapped[User] = relationship()
    messages: Mapped[list["Message"]] = relationship(back_populates="conversation")
    ticket: Mapped["Ticket | None"] = relationship(back_populates="conversation")


class Message(Base):
    __tablename__ = "messages"
    __table_args__ = (
        CheckConstraint("sender IN ('student','officer','assistant','system')", name="sender"),
        UniqueConstraint("conversation_id", "seq", name="uq_messages_conversation_seq"),
        Index("ix_messages_conversation_created", "conversation_id", "created_at", "id"),
        Index("ix_messages_ticket_created", "ticket_id", "created_at"),
    )

    id: Mapped[str] = mapped_column(ID, primary_key=True)
    conversation_id: Mapped[str] = mapped_column(ForeignKey("conversations.id"), nullable=False)
    ticket_id: Mapped[str | None] = mapped_column(ForeignKey("tickets.id"))
    sender: Mapped[str] = mapped_column(String(16), nullable=False)
    sender_user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    content: Mapped[str] = mapped_column(Text, nullable=False)
    seq: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, nullable=False)

    conversation: Mapped[Conversation] = relationship(back_populates="messages")
    citations: Mapped[list["MessageCitation"]] = relationship(back_populates="message")


class MessageCitation(Base):
    __tablename__ = "message_citations"

    id: Mapped[str] = mapped_column(ID, primary_key=True)
    message_id: Mapped[str] = mapped_column(ForeignKey("messages.id"), nullable=False, index=True)
    document_id: Mapped[str] = mapped_column(ID, nullable=False)
    document_title: Mapped[str] = mapped_column(String(1000), nullable=False)
    document_version: Mapped[str] = mapped_column(ID, nullable=False)
    chunk_id: Mapped[str] = mapped_column(ID, nullable=False)
    locator: Mapped[str] = mapped_column(String(1000), nullable=False)
    quote: Mapped[str] = mapped_column(Text, nullable=False)
    url: Mapped[str | None] = mapped_column(Text)

    message: Mapped[Message] = relationship(back_populates="citations")


class Preview(Base):
    __tablename__ = "previews"
    __table_args__ = (CheckConstraint("status IN ('active','consumed','invalidated')", name="status"),)

    id: Mapped[str] = mapped_column(ID, primary_key=True)
    conversation_id: Mapped[str] = mapped_column(ForeignKey("conversations.id"), nullable=False, index=True)
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    service_type: Mapped[str] = mapped_column(String(64), nullable=False, default="student_certificate")
    purpose: Mapped[str | None] = mapped_column(Text)
    destination_org: Mapped[str | None] = mapped_column(String(300))
    receive_method: Mapped[str | None] = mapped_column(String(32))
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    expires_at: Mapped[datetime] = mapped_column(UTCDateTime, nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="active")
    missing_fields: Mapped[list] = mapped_column(PortableJSON, nullable=False, default=list)
    invalid_fields: Mapped[list] = mapped_column(PortableJSON, nullable=False, default=list)
    consumed_ticket_id: Mapped[str | None] = mapped_column(ForeignKey("tickets.id"))
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime, nullable=False)


class PreviewRevision(Base):
    __tablename__ = "preview_revisions"
    __table_args__ = (UniqueConstraint("preview_id", "version", name="uq_preview_revisions_version"),)

    id: Mapped[str] = mapped_column(ID, primary_key=True)
    preview_id: Mapped[str] = mapped_column(ForeignKey("previews.id"), nullable=False)
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    purpose: Mapped[str | None] = mapped_column(Text)
    destination_org: Mapped[str | None] = mapped_column(String(300))
    receive_method: Mapped[str | None] = mapped_column(String(32))
    missing_fields: Mapped[list] = mapped_column(PortableJSON, nullable=False, default=list)
    invalid_fields: Mapped[list] = mapped_column(PortableJSON, nullable=False, default=list)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, nullable=False)


class IntakeOperation(Base):
    __tablename__ = "intake_operations"
    __table_args__ = (
        CheckConstraint(
            "state IN ('processing','completed','retryable_failed','terminal_failed')",
            name="state",
        ),
        Index(
            "uq_intake_ops_processing",
            "conversation_id",
            unique=True,
            sqlite_where=text("state = 'processing'"),
            postgresql_where=text("state = 'processing'"),
        ),
    )

    id: Mapped[str] = mapped_column(ID, primary_key=True)
    conversation_id: Mapped[str] = mapped_column(ForeignKey("conversations.id"), nullable=False, index=True)
    actor_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)
    request_id: Mapped[str] = mapped_column(ID, nullable=False)
    idempotency_key: Mapped[str | None] = mapped_column(String(128))
    state: Mapped[str] = mapped_column(String(32), nullable=False, default="processing")
    user_message_id: Mapped[str | None] = mapped_column(ForeignKey("messages.id"))
    route: Mapped[str | None] = mapped_column(String(8))
    outcome: Mapped[str | None] = mapped_column(String(64))
    payload_hash: Mapped[str | None] = mapped_column(String(64))
    last_error: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime, nullable=False)


class SafetyDecision(Base):
    __tablename__ = "safety_decisions"

    id: Mapped[str] = mapped_column(ID, primary_key=True)
    conversation_id: Mapped[str] = mapped_column(ForeignKey("conversations.id"), nullable=False, index=True)
    operation_id: Mapped[str] = mapped_column(ForeignKey("intake_operations.id"), nullable=False, unique=True)
    message_id: Mapped[str] = mapped_column(ForeignKey("messages.id"), nullable=False)
    risk_type: Mapped[str] = mapped_column(String(64), nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    source_message_ids: Mapped[list] = mapped_column(PortableJSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, nullable=False)


class Ticket(Base):
    __tablename__ = "tickets"
    __table_args__ = (
        CheckConstraint("status IN ('open','pending_officer','resolved')", name="status"),
        CheckConstraint("priority IN ('normal','high')", name="priority"),
        CheckConstraint("category IN ('action','complaint')", name="category"),
        CheckConstraint(
            "service_type IN ('student_certificate','academic_complaint','student_support')",
            name="service_type",
        ),
        Index("ix_tickets_student_created", "student_id", "created_at"),
        Index("ix_tickets_team_status_priority_created", "team_id", "status", "priority", "created_at"),
        Index("ix_tickets_assignee", "assigned_officer_id"),
    )

    id: Mapped[str] = mapped_column(ID, primary_key=True)
    code: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    conversation_id: Mapped[str] = mapped_column(ForeignKey("conversations.id"), nullable=False, unique=True)
    student_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)
    team_id: Mapped[str] = mapped_column(ForeignKey("teams.id"), nullable=False)
    assigned_officer_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    category: Mapped[str] = mapped_column(String(16), nullable=False)
    service_type: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    priority: Mapped[str] = mapped_column(String(16), nullable=False)
    priority_reasons: Mapped[list] = mapped_column(PortableJSON, nullable=False, default=list)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    request_data: Mapped[dict | None] = mapped_column(PortableJSON)
    handover_reason: Mapped[str | None] = mapped_column(Text)
    officer_draft: Mapped[str | None] = mapped_column(Text)
    officer_checklist: Mapped[list] = mapped_column(PortableJSON, nullable=False, default=list)
    system_verifications: Mapped[list] = mapped_column(PortableJSON, nullable=False, default=list)
    revision: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime, nullable=False)

    conversation: Mapped[Conversation] = relationship(back_populates="ticket")
    student: Mapped[User] = relationship(foreign_keys=[student_id])
    team: Mapped[Team] = relationship()
    assignee: Mapped[User | None] = relationship(foreign_keys=[assigned_officer_id])


class TicketCodeSequence(Base):
    __tablename__ = "ticket_code_sequences"

    year: Mapped[int] = mapped_column(Integer, primary_key=True)
    last_value: Mapped[int] = mapped_column(Integer, nullable=False)


class IntakePacket(Base):
    __tablename__ = "intake_packets"

    id: Mapped[str] = mapped_column(ID, primary_key=True)
    ticket_id: Mapped[str] = mapped_column(ForeignKey("tickets.id"), nullable=False, index=True)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    service_type: Mapped[str] = mapped_column(String(64), nullable=False)
    fields: Mapped[dict] = mapped_column(PortableJSON, nullable=False)
    source_message_id: Mapped[str | None] = mapped_column(ForeignKey("messages.id"))
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, nullable=False)


class HandoverPacket(Base):
    __tablename__ = "handover_packets"

    id: Mapped[str] = mapped_column(ID, primary_key=True)
    ticket_id: Mapped[str] = mapped_column(ForeignKey("tickets.id"), nullable=False, index=True)
    risk_type: Mapped[str] = mapped_column(String(64), nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    source_message_ids: Mapped[list] = mapped_column(PortableJSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, nullable=False)


class TicketAssignment(Base):
    __tablename__ = "ticket_assignments"
    __table_args__ = (CheckConstraint("action IN ('claim','transfer','release')", name="action"),)

    id: Mapped[str] = mapped_column(ID, primary_key=True)
    ticket_id: Mapped[str] = mapped_column(ForeignKey("tickets.id"), nullable=False, index=True)
    team_id: Mapped[str] = mapped_column(ForeignKey("teams.id"), nullable=False)
    officer_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    previous_officer_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    assigned_by: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)
    action: Mapped[str] = mapped_column(String(16), nullable=False, default="claim")
    assigned_at: Mapped[datetime] = mapped_column(UTCDateTime, nullable=False)
    is_demo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class TicketAttachment(Base):
    __tablename__ = "ticket_attachments"

    id: Mapped[str] = mapped_column(ID, primary_key=True)
    ticket_id: Mapped[str] = mapped_column(ForeignKey("tickets.id"), nullable=False, index=True)
    message_id: Mapped[str | None] = mapped_column(ForeignKey("messages.id"))
    filename: Mapped[str] = mapped_column(String(500), nullable=False)
    mime_type: Mapped[str] = mapped_column(String(200), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    object_key: Mapped[str | None] = mapped_column(String(1000))
    uploader_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, nullable=False)


class OfficerAction(Base):
    __tablename__ = "officer_actions"
    __table_args__ = (CheckConstraint("action IN ('respond','request_info','resolve')", name="action"),)

    id: Mapped[str] = mapped_column(ID, primary_key=True)
    ticket_id: Mapped[str] = mapped_column(ForeignKey("tickets.id"), nullable=False, index=True)
    actor_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)
    action: Mapped[str] = mapped_column(String(32), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    expected_revision: Mapped[int] = mapped_column(Integer, nullable=False)
    reviewed_brief_version: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, nullable=False)


class OfficerBrief(Base):
    __tablename__ = "officer_briefs"
    __table_args__ = (
        UniqueConstraint("ticket_id", "brief_version", name="uq_officer_briefs_version"),
        CheckConstraint("status IN ('pending','processing','ready','failed','stale')", name="status"),
        Index("ix_officer_briefs_ticket_current", "ticket_id", "is_current"),
    )

    id: Mapped[str] = mapped_column(ID, primary_key=True)
    ticket_id: Mapped[str] = mapped_column(ForeignKey("tickets.id"), nullable=False)
    brief_version: Mapped[int] = mapped_column(Integer, nullable=False)
    source_ticket_revision: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False)
    quality_status: Mapped[str | None] = mapped_column(String(16))
    is_current: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    summary: Mapped[str | None] = mapped_column(Text)
    facts: Mapped[list | None] = mapped_column(PortableJSON)
    missing_items: Mapped[list | None] = mapped_column(PortableJSON)
    checklist: Mapped[list | None] = mapped_column(PortableJSON)
    suggested_priority: Mapped[str | None] = mapped_column(String(16))
    priority_reasons: Mapped[list | None] = mapped_column(PortableJSON)
    draft_reply: Mapped[str | None] = mapped_column(Text)
    citations: Mapped[list | None] = mapped_column(PortableJSON)
    warnings: Mapped[list | None] = mapped_column(PortableJSON)
    model_name: Mapped[str | None] = mapped_column(ID)
    prompt_version: Mapped[str | None] = mapped_column(ID)
    template_version: Mapped[str | None] = mapped_column(ID)
    index_version: Mapped[str | None] = mapped_column(ID)
    error: Mapped[dict | None] = mapped_column(PortableJSON)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime, nullable=False)

    facts_rows: Mapped[list["FactProvenance"]] = relationship(back_populates="brief")


class FactProvenance(Base):
    __tablename__ = "fact_provenance"
    __table_args__ = (
        CheckConstraint(
            "source_type IN ('student_message','profile','policy','tool_result')",
            name="source_type",
        ),
        CheckConstraint("verification_status IN ('unverified','verified','disputed')", name="verification"),
    )

    id: Mapped[str] = mapped_column(ID, primary_key=True)
    brief_id: Mapped[str] = mapped_column(ForeignKey("officer_briefs.id"), nullable=False, index=True)
    key: Mapped[str] = mapped_column(ID, nullable=False)
    value: Mapped[str] = mapped_column(Text, nullable=False)
    source_type: Mapped[str] = mapped_column(String(32), nullable=False)
    source_id: Mapped[str] = mapped_column(ID, nullable=False)
    verification_status: Mapped[str] = mapped_column(String(16), nullable=False)

    brief: Mapped[OfficerBrief] = relationship(back_populates="facts_rows")


class AuditEntry(Base):
    __tablename__ = "audit_entries"
    __table_args__ = (Index("ix_audit_ticket_created", "ticket_id", "created_at"),)

    id: Mapped[str] = mapped_column(ID, primary_key=True)
    ticket_id: Mapped[str] = mapped_column(ForeignKey("tickets.id"), nullable=False)
    actor_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    actor_type: Mapped[str] = mapped_column(String(16), nullable=False)
    action: Mapped[str] = mapped_column(String(32), nullable=False)
    from_status: Mapped[str | None] = mapped_column(String(32))
    to_status: Mapped[str | None] = mapped_column(String(32))
    request_id: Mapped[str] = mapped_column(ID, nullable=False)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, nullable=False)


class IdempotencyRecord(Base):
    __tablename__ = "idempotency_records"
    __table_args__ = (
        UniqueConstraint("actor_id", "operation", "resource_id", "key", name="uq_idempotency_actor_op_res_key"),
        CheckConstraint("status IN ('processing','completed')", name="status"),
        Index("ix_idempotency_expires", "expires_at"),
    )

    id: Mapped[str] = mapped_column(ID, primary_key=True)
    actor_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)
    operation: Mapped[str] = mapped_column(String(64), nullable=False)
    resource_id: Mapped[str] = mapped_column(String(128), nullable=False)
    key: Mapped[str] = mapped_column(String(128), nullable=False)
    payload_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="processing")
    http_status: Mapped[int | None] = mapped_column(Integer)
    response_json: Mapped[dict | None] = mapped_column(PortableJSON)
    expires_at: Mapped[datetime] = mapped_column(UTCDateTime, nullable=False)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime, nullable=False)


class Job(Base):
    __tablename__ = "jobs"
    __table_args__ = (
        CheckConstraint("kind IN ('prepare_brief','retry_handover')", name="kind"),
        CheckConstraint("state IN ('pending','leased','succeeded','failed','cancelled')", name="state"),
        Index("ix_jobs_state_available", "state", "available_at"),
        Index("ix_jobs_lease_until", "lease_until"),
        Index(
            "uq_jobs_prepare_brief_revision",
            "kind",
            "ticket_id",
            "source_revision",
            unique=True,
            sqlite_where=text("kind = 'prepare_brief' AND ticket_id IS NOT NULL AND source_revision IS NOT NULL"),
            postgresql_where=text("kind = 'prepare_brief' AND ticket_id IS NOT NULL AND source_revision IS NOT NULL"),
        ),
        Index(
            "uq_jobs_retry_handover_operation",
            "kind",
            "operation_id",
            unique=True,
            sqlite_where=text("kind = 'retry_handover' AND operation_id IS NOT NULL"),
            postgresql_where=text("kind = 'retry_handover' AND operation_id IS NOT NULL"),
        ),
    )

    id: Mapped[str] = mapped_column(ID, primary_key=True)
    kind: Mapped[str] = mapped_column(String(32), nullable=False)
    ticket_id: Mapped[str | None] = mapped_column(ForeignKey("tickets.id"))
    conversation_id: Mapped[str | None] = mapped_column(ForeignKey("conversations.id"))
    operation_id: Mapped[str | None] = mapped_column(ID)
    source_revision: Mapped[int | None] = mapped_column(Integer)
    state: Mapped[str] = mapped_column(String(16), nullable=False, default="pending")
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    available_at: Mapped[datetime] = mapped_column(UTCDateTime, nullable=False)
    lease_until: Mapped[datetime | None] = mapped_column(UTCDateTime)
    last_error: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime, nullable=False)


class ReviewCodeSequence(Base):
    __tablename__ = "review_code_sequences"

    year: Mapped[int] = mapped_column(Integer, primary_key=True)
    last_value: Mapped[int] = mapped_column(Integer, nullable=False)


class ReviewCase(Base):
    __tablename__ = "review_cases"
    __table_args__ = (
        CheckConstraint("status IN ('draft','in_review','waiting_supplement','completed')", name="review_status"),
        Index("ix_review_cases_student", "student_id", "created_at"),
        Index("ix_review_cases_officer", "officer_id", "status"),
    )

    id: Mapped[str] = mapped_column(ID, primary_key=True)
    code: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    student_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)
    officer_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="in_review")
    revision: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    payload: Mapped[dict] = mapped_column(PortableJSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime, nullable=False)

    student: Mapped[User] = relationship(foreign_keys=[student_id])
    officer: Mapped[User | None] = relationship(foreign_keys=[officer_id])
