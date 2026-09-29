"""P0 v1 wire contracts. These types do not implement authorization or persistence."""

from typing import Annotated, Generic, Literal, Self, TypeVar

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, StringConstraints, model_validator

CONTRACT_VERSION = "P0-contract-v1"
Id = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=128)]
Text = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=10000)]
Content = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=5000)]
Role = Literal["student", "officer"]
Status = Literal["open", "pending_officer", "resolved"]
Priority = Literal["normal", "high"]
Route = Literal["L1", "L2", "L4"]
Risk = Literal["academic_complaint", "wellbeing", "unauthorized_action"]
Method = Literal["digital_pdf", "paper_stamped"]


class Contract(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Actor(Contract):
    user_id: Id
    role: Role


class Profile(Contract):
    student_id: Id
    full_name: Text | None
    mssv: Id | None
    faculty: Text | None
    cohort: Text | None
    is_demo: Literal[True]


class Message(Contract):
    id: Id
    conversation_id: Id
    ticket_id: Id | None
    sender: Literal["student", "officer", "assistant", "system"]
    content: Text
    created_at: AwareDatetime


class Citation(Contract):
    document_id: Id
    document_title: Text
    document_version: Id
    chunk_id: Id
    locator: Text
    quote: Text
    url: str | None


class RetrievalRequest(Contract):
    query: Content
    policy_scope: Id
    top_k: int = Field(default=5, ge=1, le=10)
    effective_at: AwareDatetime


class Passage(Contract):
    citation: Citation
    text: Text
    score: float | None


class RetrievalResult(Contract):
    status: Literal["found", "empty"]
    passages: list[Passage]
    index_version: Id

    @model_validator(mode="after")
    def check_passages(self) -> Self:
        if (self.status == "found") != bool(self.passages):
            raise ValueError("found requires passages; empty forbids passages")
        return self


class RagRequest(Contract):
    question: Content
    history: list[Message] = Field(max_length=20)
    policy_scope: Id
    effective_at: AwareDatetime


class RagResult(Contract):
    status: Literal["answered", "needs_clarification", "insufficient_evidence"]
    answer: Text
    citations: list[Citation]

    @model_validator(mode="after")
    def grounded_answer(self) -> Self:
        if self.status == "answered" and not self.citations:
            raise ValueError("answered requires citations")
        return self


class Fields(Contract):
    purpose: Annotated[str, StringConstraints(strip_whitespace=True, min_length=5, max_length=1000)] | None
    destination_org: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=300)] | None
    receive_method: Method | None


class FieldIssue(Contract):
    field: Literal["purpose", "destination_org", "receive_method"]
    reason: Text


class Intake(Contract):
    service_type: Literal["student_certificate"]
    fields: Fields
    missing_fields: list[Literal["purpose", "destination_org", "receive_method"]]
    invalid_fields: list[FieldIssue]

    @model_validator(mode="after")
    def consistent_missing_fields(self) -> Self:
        missing = {key for key, value in self.fields.model_dump().items() if value is None}
        if missing != set(self.missing_fields) or len(set(self.missing_fields)) != len(self.missing_fields):
            raise ValueError("missing_fields must match null fields without duplicates")
        return self


class Preview(Intake):
    id: Id
    version: int = Field(ge=1)
    can_submit: bool
    expires_at: AwareDatetime

    @model_validator(mode="after")
    def valid_submission(self) -> Self:
        if self.can_submit and (self.missing_fields or self.invalid_fields):
            raise ValueError("incomplete preview cannot be submitted")
        return self


class Handover(Contract):
    risk_type: Risk
    reason: Text
    summary: Text
    source_message_ids: list[Id] = Field(min_length=1)


class TicketRef(Contract):
    id: Id
    code: Id
    status: Status
    priority: Priority


class Ticket(TicketRef):
    conversation_id: Id
    student_id: Id
    category: Literal["action", "complaint"]
    service_type: Literal["student_certificate", "academic_complaint", "student_support"]
    priority_reasons: list[Text]
    summary: Text
    request_data: Fields | None
    handover_reason: Text | None
    assigned_officer_id: Id | None
    revision: int = Field(ge=1)
    created_at: AwareDatetime
    updated_at: AwareDatetime


class ConversationState(Contract):
    status: Literal["active", "handover", "closed"]
    ai_response_locked: bool
    handover_status: Literal["none", "pending", "failed", "completed"]

    @model_validator(mode="after")
    def enforce_lock(self) -> Self:
        if self.handover_status != "none" and (not self.ai_response_locked or self.status == "active"):
            raise ValueError("handover requires a locked, non-active conversation")
        if self.status == "handover" and self.handover_status == "none":
            raise ValueError("handover status must be present")
        return self


class Conversation(ConversationState):
    id: Id
    revision: int = Field(ge=1)
    ticket_id: Id | None
    created_at: AwareDatetime
    updated_at: AwareDatetime


class IntakeContext(Contract):
    request_id: Id
    conversation_id: Id
    conversation_revision: int = Field(ge=1)
    actor: Actor
    student_profile: Profile
    message: Message
    history: list[Message] = Field(max_length=20)
    preview: Preview | None
    linked_ticket: Ticket | None
    policy_scope: Id
    effective_at: AwareDatetime


class IntakeResult(Contract):
    route: Route
    outcome: Literal[
        "answered", "needs_clarification", "insufficient_evidence", "collecting", "preview_ready", "handover_required"
    ]
    reply: Text | None
    citations: list[Citation]
    intake: Intake | None
    handover: Handover | None

    @model_validator(mode="after")
    def validate_branch(self) -> Self:
        if self.route == "L1":
            if (
                self.outcome not in {"answered", "needs_clarification", "insufficient_evidence"}
                or self.reply is None
                or self.intake
                or self.handover
            ):
                raise ValueError("invalid L1 branch")
            RagResult(status=self.outcome, answer=self.reply, citations=self.citations)
        elif self.route == "L2":
            if (
                self.outcome not in {"collecting", "preview_ready"}
                or self.intake is None
                or self.reply is None
                or self.handover
            ):
                raise ValueError("invalid L2 branch")
            if self.outcome == "preview_ready" and (self.intake.missing_fields or self.intake.invalid_fields):
                raise ValueError("preview_ready requires complete valid fields")
        elif (
            self.outcome != "handover_required"
            or self.handover is None
            or self.reply is not None
            or self.intake is not None
            or self.citations
        ):
            raise ValueError("L4 cannot announce success or return a student draft")
        return self


class Fact(Contract):
    key: Id
    value: Text
    source_type: Literal["student_message", "profile", "policy", "tool_result"]
    source_id: Id
    verification_status: Literal["unverified", "verified", "disputed"]

    @model_validator(mode="after")
    def no_verified_claim(self) -> Self:
        if self.source_type == "student_message" and self.verification_status == "verified":
            raise ValueError("a student claim cannot be marked verified by AI")
        return self


class ChecklistItem(Contract):
    id: Id
    label: Text
    checked: Literal[False]


class MissingItem(Contract):
    field: Id
    reason: Text


class WarningItem(Contract):
    code: Id
    message: Text


class OfficerBrief(Contract):
    ticket_id: Id
    source_ticket_revision: int = Field(ge=1)
    summary: Annotated[str, StringConstraints(min_length=1, max_length=2000)]
    facts: list[Fact]
    missing_items: list[MissingItem]
    checklist: list[ChecklistItem]
    suggested_priority: Priority
    priority_reasons: list[Text]
    draft_reply: Text | None
    citations: list[Citation]
    warnings: list[WarningItem]
    quality_status: Literal["pass", "fail"]

    @model_validator(mode="after")
    def priority_reason(self) -> Self:
        if self.suggested_priority == "high" and not self.priority_reasons:
            raise ValueError("high priority requires a reason")
        return self


class TicketSnapshot(Contract):
    ticket: Ticket
    source_ticket_revision: int = Field(ge=1)
    student_profile: Profile
    messages: list[Message]
    intake_packet: Intake | None
    handover_packet: Handover | None
    approved_sources: list[Passage]
    existing_officer_draft: Text | None
    request_id: Id

    @model_validator(mode="after")
    def consistent_revision(self) -> Self:
        if self.source_ticket_revision != self.ticket.revision:
            raise ValueError("snapshot revision mismatch")
        return self


class ChatResult(Contract):
    conversation_id: Id
    user_message_id: Id
    route: Route
    outcome: Literal[
        "answered",
        "needs_clarification",
        "insufficient_evidence",
        "collecting",
        "preview_ready",
        "handover_completed",
        "forwarded_to_officer",
        "supplement_received",
    ]
    reply: Message
    citations: list[Citation]
    preview: Preview | None
    ticket: TicketRef | None
    conversation_state: ConversationState

    @model_validator(mode="after")
    def validate_public_branch(self) -> Self:
        if self.reply.conversation_id != self.conversation_id:
            raise ValueError("reply belongs to another conversation")
        if self.reply.ticket_id != (self.ticket.id if self.ticket is not None else None):
            raise ValueError("reply ticket must match the result ticket")
        if self.outcome in {"handover_completed", "forwarded_to_officer"}:
            if (
                self.route != "L4"
                or self.ticket is None
                or self.preview is not None
                or self.reply.sender != "system"
                or not self.conversation_state.ai_response_locked
                or self.conversation_state.handover_status != "completed"
            ):
                raise ValueError("handover success requires a committed ticket and lock")
            if self.outcome == "handover_completed" and (
                self.ticket.status != "pending_officer" or self.ticket.priority != "high"
            ):
                raise ValueError("new handover must be pending_officer with high priority")
        elif self.outcome == "supplement_received":
            if (
                self.route != "L2"
                or self.ticket is None
                or self.preview is not None
                or self.reply.sender != "system"
                or self.conversation_state.ai_response_locked
            ):
                raise ValueError("invalid supplement branch")
        else:
            if (
                self.ticket is not None
                or self.conversation_state.ai_response_locked
                or self.reply.sender != "assistant"
            ):
                raise ValueError("intake replies must be unlocked assistant messages")
            intake = (
                None
                if self.preview is None
                else Intake.model_validate(
                    self.preview.model_dump(include={"service_type", "fields", "missing_fields", "invalid_fields"})
                )
            )
            IntakeResult(
                route=self.route,
                outcome=self.outcome,
                reply=self.reply.content,
                citations=self.citations,
                intake=intake,
                handover=None,
            )
            if self.outcome == "preview_ready" and not self.preview.can_submit:
                raise ValueError("ready preview must be submittable")
            if self.outcome == "collecting" and self.preview.can_submit:
                raise ValueError("collecting preview cannot be submittable")
        if self.ticket is not None and self.citations:
            raise ValueError("system receipts cannot contain AI citations")
        return self


class SendMessage(Contract):
    content: Content


class Submit1(Contract):
    preview_id: Id
    preview_version: int = Field(ge=1)
    confirmed: Literal[True]


class Submit2(Contract):
    action: Literal["respond", "request_info", "resolve"]
    content: Text
    expected_revision: int = Field(ge=1)
    reviewed_brief_version: Annotated[int, Field(ge=1)] | None
    confirmed: Literal[True]


class ClaimRequest(Contract):
    expected_revision: int = Field(ge=1)
    confirmed: Literal[True]


class PreviewPatch(Contract):
    """Replace the editable fields as a full snapshot; null clears a field."""

    expected_version: int = Field(ge=1)
    fields: Fields


class PrepareRequest(Contract):
    expected_revision: int = Field(ge=1)


class Processing(Contract):
    operation_id: Id
    status: Literal["processing"]
    poll_after_ms: Literal[2000]


class ErrorDetails(Contract):
    conversation_id: Id | None = None
    user_message_id: Id | None = None
    ticket_id: Id | None = None
    current_revision: Annotated[int, Field(ge=1)] | None = None
    current_version: Annotated[int, Field(ge=1)] | None = None
    ai_response_locked: bool | None = None
    handover_status: Literal["none", "pending", "failed", "completed", "unknown"] | None = None
    field_errors: list[MissingItem] = Field(default_factory=list)


class ErrorBody(Contract):
    code: Literal[
        "UNAUTHENTICATED",
        "FORBIDDEN",
        "RESOURCE_NOT_FOUND",
        "STALE_REVISION",
        "STALE_PREVIEW",
        "STALE_BRIEF",
        "PREVIEW_EXPIRED",
        "PREVIEW_ALREADY_SUBMITTED",
        "CONVERSATION_LOCKED",
        "CONVERSATION_BUSY",
        "TICKET_CLOSED",
        "INVALID_STATUS_TRANSITION",
        "IDEMPOTENCY_CONFLICT",
        "VALIDATION_ERROR",
        "CONFIRMATION_REQUIRED",
        "AI_UNAVAILABLE",
        "AI_OUTPUT_INVALID",
        "HANDOVER_FAILED",
        "PERSISTENCE_UNAVAILABLE",
        "RATE_LIMITED",
    ]
    message: Text
    request_id: Id
    retryable: bool
    details: ErrorDetails


class ErrorEnvelope(Contract):
    error: ErrorBody


class ModuleError(Contract):
    code: Literal[
        "PROVIDER_TIMEOUT",
        "PROVIDER_UNAVAILABLE",
        "PROVIDER_RATE_LIMITED",
        "INDEX_UNAVAILABLE",
        "OUTPUT_SCHEMA_INVALID",
        "SOURCE_REFERENCE_INVALID",
        "POLICY_SCOPE_DENIED",
    ]
    retryable: bool
    stage: Literal["retrieval", "generation", "routing", "intake", "brief", "validation"]
    request_id: Id


class ModuleCallError(Exception):
    """Modules raise this; the backend maps its safe payload to an API error."""

    def __init__(self, error: ModuleError):
        self.error = error
        super().__init__(error.code)


T = TypeVar("T")


class Page(Contract, Generic[T]):
    items: list[T]
    total: int = Field(ge=0)
    page: int = Field(ge=1)
    page_size: int = Field(ge=1, le=100)


class EmptyRequest(Contract):
    pass


class DemoLogin(Contract):
    user_id: Id


class User(Contract):
    id: Id
    role: Role
    name: Text


class LoginResult(Contract):
    access_token: Text
    token_type: Literal["Bearer"]
    expires_at: AwareDatetime
    user: User


class Submit1Result(Contract):
    ticket: Ticket
    brief_status: Literal["pending"]


class Submit2Result(Contract):
    ticket: Ticket
    message: Message
    audit_id: Id


class ClaimResult(Contract):
    ticket: Ticket
    audit_id: Id


class TicketDetail(Contract):
    ticket: Ticket
    messages: Page[Message]


class AuditEntry(Contract):
    id: Id
    ticket_id: Id
    actor_id: Id | None
    actor_type: Literal["student", "officer", "system"]
    action: Literal[
        "create",
        "handover",
        "supplement",
        "respond",
        "request_info",
        "resolve",
        "brief_ready",
        "brief_failed",
        "claim",
    ]
    from_status: Status | None
    to_status: Status | None
    request_id: Id
    created_at: AwareDatetime


class Artifact(Contract):
    brief: OfficerBrief
    brief_version: int = Field(ge=1)
    source_ticket_revision: int = Field(ge=1)
    model_name: Id
    prompt_version: Id
    template_version: Id
    index_version: Id | None
    created_at: AwareDatetime

    @model_validator(mode="after")
    def consistent_source(self) -> Self:
        if self.source_ticket_revision != self.brief.source_ticket_revision:
            raise ValueError("artifact source revision mismatch")
        return self


class BriefEnvelope(Contract):
    status: Literal["pending", "processing", "ready", "failed", "stale"]
    current_ticket_revision: int = Field(ge=1)
    brief_version: Annotated[int, Field(ge=1)] | None
    source_ticket_revision: Annotated[int, Field(ge=1)] | None
    artifact: Artifact | None
    error: ModuleError | None

    @model_validator(mode="after")
    def ready_matches_revision(self) -> Self:
        if self.artifact is not None and (
            self.brief_version != self.artifact.brief_version
            or self.source_ticket_revision != self.artifact.source_ticket_revision
        ):
            raise ValueError("envelope and artifact versions must match")
        if self.status == "ready" and (
            self.artifact is None
            or self.source_ticket_revision != self.current_ticket_revision
            or self.error is not None
        ):
            raise ValueError("ready requires an artifact at the current revision without a job error")
        if self.status == "failed" and self.error is None:
            raise ValueError("failed requires a job error")
        return self


class JobAccepted(Contract):
    job_id: Id
    ticket_id: Id
    source_ticket_revision: int = Field(ge=1)
    status: Literal["pending", "processing"]
