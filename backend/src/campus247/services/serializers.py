from datetime import UTC, datetime

from campus247.db.models import (
    AuditEntry,
    Conversation,
    Message,
    MessageCitation,
    OfficerBrief,
    Preview,
    Ticket,
    User,
)
from campus247.models import contracts_v1 as c
from campus247.services.common import ensure_utc, utcnow


def user_to_contract(user: User) -> c.User:
    return c.User(
        id=user.id,
        role=user.role,  # type: ignore[arg-type]
        name=user.name,
        username=user.username,
        email=user.email,
        account_status=getattr(user, "account_status", None) or "active",  # type: ignore[arg-type]
    )


def profile_to_contract(profile) -> c.Profile:
    return c.Profile(
        student_id=profile.user_id,
        full_name=profile.full_name,
        mssv=profile.mssv,
        faculty=profile.faculty,
        cohort=profile.cohort,
        is_demo=bool(profile.is_demo),
    )


def profile_view(profile) -> c.StudentProfileView:
    return c.StudentProfileView(
        user_id=profile.user_id,
        full_name=profile.full_name,
        mssv=profile.mssv,
        email=profile.email,
        faculty=profile.faculty,
        major=profile.major,
        cohort=profile.cohort,
        class_year=profile.class_year,
        student_status=profile.student_status,
        verification_status=profile.verification_status or "unverified",  # type: ignore[arg-type]
        source=profile.source,
        source_imported_at=profile.source_imported_at,
        verified_at=profile.verified_at,
        is_demo=bool(profile.is_demo),
    )


def message_to_contract(message: Message) -> c.Message:
    return c.Message(
        id=message.id,
        conversation_id=message.conversation_id,
        ticket_id=message.ticket_id,
        sender=message.sender,  # type: ignore[arg-type]
        content=message.content,
        created_at=ensure_utc(message.created_at),
    )


def citation_to_contract(row: MessageCitation) -> c.Citation:
    return c.Citation(
        document_id=row.document_id,
        document_title=row.document_title,
        document_version=row.document_version,
        chunk_id=row.chunk_id,
        locator=row.locator,
        quote=row.quote,
        url=row.url,
    )


def conversation_to_contract(conversation: Conversation, ticket_id: str | None) -> c.Conversation:
    return c.Conversation(
        id=conversation.id,
        status=conversation.status,  # type: ignore[arg-type]
        revision=conversation.revision,
        ai_response_locked=conversation.ai_response_locked,
        handover_status=conversation.handover_status,  # type: ignore[arg-type]
        ticket_id=ticket_id,
        created_at=ensure_utc(conversation.created_at),
        updated_at=ensure_utc(conversation.updated_at),
    )


def conversation_state(conversation: Conversation) -> c.ConversationState:
    return c.ConversationState(
        status=conversation.status,  # type: ignore[arg-type]
        ai_response_locked=conversation.ai_response_locked,
        handover_status=conversation.handover_status,  # type: ignore[arg-type]
    )


def ticket_to_contract(ticket: Ticket) -> c.Ticket:
    request_data = None
    if ticket.request_data is not None:
        request_data = c.Fields.model_validate(ticket.request_data)
    student = getattr(ticket, "student", None)
    profile = getattr(student, "profile", None) if student is not None else None
    return c.Ticket(
        id=ticket.id,
        code=ticket.code,
        conversation_id=ticket.conversation_id,
        student_id=ticket.student_id,
        category=ticket.category,  # type: ignore[arg-type]
        service_type=ticket.service_type,  # type: ignore[arg-type]
        status=ticket.status,  # type: ignore[arg-type]
        priority=ticket.priority,  # type: ignore[arg-type]
        priority_reasons=list(ticket.priority_reasons or []),
        summary=ticket.summary,
        request_data=request_data,
        handover_reason=ticket.handover_reason,
        assigned_officer_id=ticket.assigned_officer_id,
        revision=ticket.revision,
        created_at=ensure_utc(ticket.created_at),
        updated_at=ensure_utc(ticket.updated_at),
        student_name=(profile.full_name if profile and profile.full_name else (student.name if student else None)),
        student_mssv=(profile.mssv if profile else None),
    )


def ticket_ref(ticket: Ticket) -> c.TicketRef:
    return c.TicketRef(
        id=ticket.id,
        code=ticket.code,
        status=ticket.status,  # type: ignore[arg-type]
        priority=ticket.priority,  # type: ignore[arg-type]
    )


def preview_fields_from_row(preview: Preview) -> c.Fields:
    if preview.fields_payload:
        try:
            return c.Fields.model_validate(preview.fields_payload)
        except Exception:
            pass
    return c.Fields(
        purpose=preview.purpose,
        destination_org=preview.destination_org,
        receive_method=preview.receive_method,  # type: ignore[arg-type]
    )


def intake_from_stored(service_type: str, fields_payload: object | None) -> c.Intake:
    from campus247.models.intake_fields import missing_fields_for

    kind = service_type if service_type in {"student_certificate", "academic_complaint"} else "student_certificate"
    fields = c.Fields.model_validate(fields_payload or {})
    return c.Intake(
        service_type=kind,  # type: ignore[arg-type]
        fields=fields,
        missing_fields=missing_fields_for(kind, fields),  # type: ignore[arg-type]
        invalid_fields=[],
    )


def apply_fields_to_preview(preview: Preview, fields: c.Fields) -> None:
    payload = fields.model_dump(mode="json")
    preview.fields_payload = payload
    preview.purpose = fields.purpose
    preview.destination_org = fields.destination_org
    preview.receive_method = fields.receive_method


def preview_to_contract(preview: Preview, now: datetime | None = None) -> c.Preview:
    from campus247.models.intake_fields import missing_fields_for

    now = now or utcnow()
    fields = preview_fields_from_row(preview)
    service_type = preview.service_type if preview.service_type in {"student_certificate", "academic_complaint"} else "student_certificate"
    missing = list(preview.missing_fields or missing_fields_for(service_type, fields))
    invalid = []
    for item in preview.invalid_fields or []:
        try:
            invalid.append(c.FieldIssue.model_validate(item))
        except Exception:
            continue
    expires = ensure_utc(preview.expires_at)
    expected_missing = missing_fields_for(service_type, fields)
    can_submit = (
        preview.status == "active"
        and not expected_missing
        and not invalid
        and expires > now
    )
    return c.Preview(
        id=preview.id,
        version=preview.version,
        service_type=service_type,  # type: ignore[arg-type]
        fields=fields,
        missing_fields=expected_missing,  # type: ignore[arg-type]
        invalid_fields=invalid,
        can_submit=can_submit,
        expires_at=expires,
    )


def audit_to_contract(entry: AuditEntry, actor_name: str | None = None) -> c.AuditEntry:
    return c.AuditEntry(
        id=entry.id,
        ticket_id=entry.ticket_id,
        actor_id=entry.actor_id,
        actor_type=entry.actor_type,  # type: ignore[arg-type]
        action=entry.action,  # type: ignore[arg-type]
        from_status=entry.from_status,  # type: ignore[arg-type]
        to_status=entry.to_status,  # type: ignore[arg-type]
        request_id=entry.request_id,
        details=entry.details,
        created_at=ensure_utc(entry.created_at),
        actor_name=actor_name,
    )


def brief_envelope(ticket: Ticket, brief: OfficerBrief | None) -> c.BriefEnvelope:
    current_rev = ticket.revision
    if brief is None:
        return c.BriefEnvelope(
            status="pending",
            current_ticket_revision=current_rev,
            brief_version=None,
            source_ticket_revision=None,
            artifact=None,
            error=None,
        )
    status = brief.status
    if brief.status == "ready" and brief.source_ticket_revision != current_rev:
        status = "stale"
    artifact = None
    if brief.summary and brief.status in {"ready", "stale"} or (status == "stale" and brief.summary):
        officer_brief = c.OfficerBrief(
            ticket_id=ticket.id,
            source_ticket_revision=brief.source_ticket_revision,
            summary=brief.summary,
            facts=[c.Fact.model_validate(item) for item in (brief.facts or [])],
            missing_items=[c.MissingItem.model_validate(item) for item in (brief.missing_items or [])],
            checklist=[c.ChecklistItem.model_validate(item) for item in (brief.checklist or [])],
            suggested_priority=brief.suggested_priority or "normal",  # type: ignore[arg-type]
            priority_reasons=list(brief.priority_reasons or []),
            draft_reply=brief.draft_reply,
            citations=[c.Citation.model_validate(item) for item in (brief.citations or [])],
            warnings=[c.WarningItem.model_validate(item) for item in (brief.warnings or [])],
            quality_status=brief.quality_status or "fail",  # type: ignore[arg-type]
        )
        artifact = c.Artifact(
            brief=officer_brief,
            brief_version=brief.brief_version,
            source_ticket_revision=brief.source_ticket_revision,
            model_name=brief.model_name or "stub",
            prompt_version=brief.prompt_version or "1",
            template_version=brief.template_version or "1",
            index_version=brief.index_version,
            created_at=ensure_utc(brief.created_at),
        )
    error = None
    if brief.error:
        error = c.ModuleError.model_validate(brief.error)
    if status == "failed" and error is None:
        error = c.ModuleError(code="PROVIDER_UNAVAILABLE", retryable=True, stage="brief", request_id="unknown")
    if status == "ready" and artifact is None:
        status = "pending"
    return c.BriefEnvelope(
        status=status,  # type: ignore[arg-type]
        current_ticket_revision=current_rev,
        brief_version=brief.brief_version if artifact is not None else None,
        source_ticket_revision=brief.source_ticket_revision if artifact is not None else None,
        artifact=artifact,
        error=error if status == "failed" else None,
    )


def to_aware_json_datetime(value: datetime) -> datetime:
    return value.astimezone(UTC)
