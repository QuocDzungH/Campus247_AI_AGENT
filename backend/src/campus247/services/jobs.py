from datetime import timedelta

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from campus247.config import get_settings
from campus247.db.engine import dialect_name
from campus247.db.models import Job, OfficerBrief, Ticket
from campus247.models.contracts_v1 import Intake, ModuleCallError
from campus247.models.contracts_v1 import OfficerBrief as BriefModel
from campus247.models.ports_v1 import AgentPort
from campus247.services.common import lock_select, new_id, utcnow
from campus247.services.serializers import message_to_contract, profile_to_contract, ticket_to_contract

BACKOFF_SECONDS = {1: 2, 2: 8}


def enqueue_prepare_brief(session: Session, ticket: Ticket) -> Job:
    now = utcnow()
    existing = session.execute(
        select(Job).where(
            Job.kind == "prepare_brief",
            Job.ticket_id == ticket.id,
            Job.source_revision == ticket.revision,
            Job.state.in_(("pending", "leased", "succeeded")),
        )
    ).scalar_one_or_none()
    if existing is not None:
        return existing
    job = Job(
        id=new_id("job"),
        kind="prepare_brief",
        ticket_id=ticket.id,
        conversation_id=ticket.conversation_id,
        source_revision=ticket.revision,
        state="pending",
        attempts=0,
        available_at=now,
        created_at=now,
        updated_at=now,
    )
    session.add(job)
    session.flush()
    return job


def enqueue_retry_handover(session: Session, conversation_id: str, operation_id: str) -> Job:
    now = utcnow()
    existing = session.execute(
        select(Job).where(Job.kind == "retry_handover", Job.operation_id == operation_id)
    ).scalar_one_or_none()
    if existing is not None and existing.state in {"pending", "leased"}:
        return existing
    job = Job(
        id=new_id("job"),
        kind="retry_handover",
        conversation_id=conversation_id,
        operation_id=operation_id,
        state="pending",
        attempts=0,
        available_at=now,
        created_at=now,
        updated_at=now,
    )
    session.add(job)
    session.flush()
    return job


def lease_next_job(session: Session) -> Job | None:
    settings = get_settings()
    now = utcnow()
    stmt = select(Job).where(
        Job.available_at <= now,
        or_(
            Job.state == "pending",
            (Job.state == "leased") & ((Job.lease_until.is_(None)) | (Job.lease_until < now)),
        ),
    ).order_by(Job.available_at, Job.id)
    if dialect_name(session) == "postgresql":
        stmt = stmt.with_for_update(skip_locked=True)
    else:
        stmt = lock_select(session, stmt)
    job = session.execute(stmt.limit(1)).scalar_one_or_none()
    if job is None:
        return None
    job.state = "leased"
    job.attempts += 1
    job.lease_until = now + timedelta(seconds=settings.worker_lease_seconds)
    job.updated_at = now
    session.flush()
    return job


def heartbeat(session: Session, job: Job) -> None:
    now = utcnow()
    job.lease_until = now + timedelta(seconds=get_settings().worker_lease_seconds)
    job.updated_at = now


def fail_or_retry(session: Session, job: Job, error: str) -> None:
    settings = get_settings()
    now = utcnow()
    job.last_error = error[:2000]
    job.updated_at = now
    if job.attempts >= settings.worker_max_attempts:
        job.state = "failed"
        job.lease_until = None
        if job.kind == "prepare_brief" and job.ticket_id:
            _mark_brief_failed(session, job, error)
        return
    delay = BACKOFF_SECONDS.get(job.attempts, 8)
    job.state = "pending"
    job.available_at = now + timedelta(seconds=delay)
    job.lease_until = None


async def process_job(session: Session, job: Job, agent: AgentPort) -> None:
    if job.kind == "prepare_brief":
        await _process_prepare_brief(session, job, agent)
        return
    from campus247.services.student import retry_handover

    retry_handover(session, job)


async def _process_prepare_brief(session: Session, job: Job, agent: AgentPort) -> None:
    from campus247.db.models import HandoverPacket, IntakePacket, Message, StudentProfile

    ticket = session.get(Ticket, job.ticket_id)
    if ticket is None:
        job.state = "failed"
        job.last_error = "ticket_missing"
        session.commit()
        return
    if job.source_revision != ticket.revision:
        job.state = "cancelled"
        job.updated_at = utcnow()
        session.commit()
        return
    heartbeat(session, job)
    session.commit()

    profile = session.get(StudentProfile, ticket.student_id)
    messages = session.execute(
        select(Message).where(Message.conversation_id == ticket.conversation_id).order_by(Message.created_at, Message.id)
    ).scalars().all()
    intake_row = session.execute(
        select(IntakePacket).where(IntakePacket.ticket_id == ticket.id).order_by(IntakePacket.version.desc())
    ).scalars().first()
    handover_row = session.execute(
        select(HandoverPacket).where(HandoverPacket.ticket_id == ticket.id).order_by(HandoverPacket.created_at.desc())
    ).scalars().first()
    from campus247.models.contracts_v1 import Handover, TicketSnapshot

    snapshot = TicketSnapshot(
        ticket=ticket_to_contract(ticket),
        source_ticket_revision=ticket.revision,
        student_profile=profile_to_contract(profile) if profile is not None else _empty_profile(ticket.student_id),
        messages=[message_to_contract(item) for item in messages],
        intake_packet=Intake.model_validate(
            {
                "service_type": intake_row.service_type,
                "fields": intake_row.fields,
                "missing_fields": [key for key, value in (intake_row.fields or {}).items() if value is None],
                "invalid_fields": [],
            }
        )
        if intake_row is not None
        else None,
        handover_packet=Handover.model_validate(
            {
                "risk_type": handover_row.risk_type,
                "reason": handover_row.reason,
                "summary": handover_row.summary,
                "source_message_ids": handover_row.source_message_ids,
            }
        )
        if handover_row is not None
        else None,
        approved_sources=[],
        existing_officer_draft=ticket.officer_draft,
        request_id=job.id,
    )
    try:
        brief = await agent.prepare_officer_brief(snapshot)
    except ModuleCallError as exc:
        fail_or_retry(session, job, exc.error.code)
        session.commit()
        return
    except Exception as exc:  # noqa: BLE001
        fail_or_retry(session, job, type(exc).__name__)
        session.commit()
        return

    ticket = session.get(Ticket, job.ticket_id)
    if ticket is None:
        job.state = "failed"
        session.commit()
        return
    if ticket.revision != job.source_revision:
        _store_brief(session, ticket, brief, job, current=False, status="stale")
        job.state = "succeeded"
        job.updated_at = utcnow()
        session.commit()
        return
    _store_brief(session, ticket, brief, job, current=True, status="ready")
    job.state = "succeeded"
    job.lease_until = None
    job.updated_at = utcnow()
    _audit_brief(session, ticket, "brief_ready", job.id)
    session.commit()


def _store_brief(session: Session, ticket: Ticket, brief: BriefModel, job: Job, *, current: bool, status: str) -> None:
    from campus247.db.models import FactProvenance

    now = utcnow()
    if current:
        for row in session.execute(select(OfficerBrief).where(OfficerBrief.ticket_id == ticket.id, OfficerBrief.is_current.is_(True))).scalars():
            row.is_current = False
            if row.status == "ready":
                row.status = "stale"
            row.updated_at = now
    latest = session.execute(
        select(OfficerBrief).where(OfficerBrief.ticket_id == ticket.id).order_by(OfficerBrief.brief_version.desc())
    ).scalars().first()
    version = (latest.brief_version + 1) if latest is not None else 1
    row = OfficerBrief(
        id=new_id("brf"),
        ticket_id=ticket.id,
        brief_version=version,
        source_ticket_revision=brief.source_ticket_revision,
        status=status,
        quality_status=brief.quality_status,
        is_current=current,
        summary=brief.summary,
        facts=[item.model_dump(mode="json") for item in brief.facts],
        missing_items=[item.model_dump(mode="json") for item in brief.missing_items],
        checklist=[item.model_dump(mode="json") for item in brief.checklist],
        suggested_priority=brief.suggested_priority,
        priority_reasons=list(brief.priority_reasons),
        draft_reply=brief.draft_reply,
        citations=[item.model_dump(mode="json") for item in brief.citations],
        warnings=[item.model_dump(mode="json") for item in brief.warnings],
        model_name="stub-agent",
        prompt_version="1",
        template_version="1",
        index_version=None,
        created_at=now,
        updated_at=now,
    )
    session.add(row)
    session.flush()
    for fact in brief.facts:
        session.add(
            FactProvenance(
                id=new_id("fact"),
                brief_id=row.id,
                key=fact.key,
                value=fact.value,
                source_type=fact.source_type,
                source_id=fact.source_id,
                verification_status=fact.verification_status,
            )
        )


def _mark_brief_failed(session: Session, job: Job, error: str) -> None:
    now = utcnow()
    ticket = session.get(Ticket, job.ticket_id)
    if ticket is None:
        return
    latest = session.execute(
        select(OfficerBrief).where(OfficerBrief.ticket_id == ticket.id).order_by(OfficerBrief.brief_version.desc())
    ).scalars().first()
    version = (latest.brief_version + 1) if latest is not None else 1
    session.add(
        OfficerBrief(
            id=new_id("brf"),
            ticket_id=ticket.id,
            brief_version=version,
            source_ticket_revision=job.source_revision or ticket.revision,
            status="failed",
            is_current=True,
            error={"code": "PROVIDER_UNAVAILABLE", "retryable": True, "stage": "brief", "request_id": job.id},
            created_at=now,
            updated_at=now,
        )
    )
    _audit_brief(session, ticket, "brief_failed", job.id)


def _audit_brief(session: Session, ticket: Ticket, action: str, request_id: str) -> None:
    from campus247.db.models import AuditEntry

    now = utcnow()
    session.add(
        AuditEntry(
            id=new_id("aud"),
            ticket_id=ticket.id,
            actor_id=None,
            actor_type="system",
            action=action,
            from_status=ticket.status,
            to_status=ticket.status,
            request_id=request_id,
            created_at=now,
        )
    )


def _empty_profile(student_id: str):
    from campus247.models.contracts_v1 import Profile

    return Profile(student_id=student_id, full_name=None, mssv=None, faculty=None, cohort=None, is_demo=True)


def mark_briefs_stale(session: Session, ticket_id: str) -> None:
    now = utcnow()
    for row in session.execute(select(OfficerBrief).where(OfficerBrief.ticket_id == ticket_id, OfficerBrief.is_current.is_(True))).scalars():
        if row.status in {"ready", "pending", "processing"}:
            row.status = "stale"
        row.updated_at = now
