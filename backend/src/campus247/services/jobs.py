import asyncio
import inspect
from collections.abc import Awaitable
from datetime import timedelta

from sqlalchemy import or_, select, update
from sqlalchemy.orm import Session

from campus247.agents.errors import MODULE_ERROR_CODES, NON_RETRYABLE_MODULE_CODES, RETRYABLE_MODULE_CODES
from campus247.agents.metadata import metadata_from_agent
from campus247.config import get_settings
from campus247.db.engine import dialect_name
from campus247.db.models import Job, OfficerBrief, Ticket
from campus247.models.contracts_v1 import ModuleCallError, RetrievalRequest
from campus247.models.contracts_v1 import OfficerBrief as BriefModel
from campus247.models.ports_v1 import AgentPort
from campus247.services.common import lock_select, new_id, utcnow
from campus247.services.serializers import (
    intake_from_stored,
    message_to_contract,
    profile_to_contract,
    ticket_to_contract,
)

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
    stmt = (
        select(Job)
        .where(
            Job.available_at <= now,
            or_(
                Job.state == "pending",
                (Job.state == "leased") & ((Job.lease_until.is_(None)) | (Job.lease_until < now)),
            ),
        )
        .order_by(Job.available_at, Job.id)
    )
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


def heartbeat(session: Session, job: Job, owner_attempts: int) -> bool:
    """Extend lease_until only if this worker still owns the lease. Does not commit."""
    now = utcnow()
    return _update_if_owner(
        session,
        job,
        owner_attempts,
        lease_until=now + timedelta(seconds=get_settings().worker_lease_seconds),
        updated_at=now,
    )


def fail_or_retry(session: Session, job: Job, error: str, owner_attempts: int) -> bool:
    """Mark failed/pending only if this worker still owns the lease. Does not commit."""
    settings = get_settings()
    now = utcnow()
    give_up = owner_attempts >= settings.worker_max_attempts or error in NON_RETRYABLE_MODULE_CODES
    values: dict[str, object] = {
        "last_error": error[:2000],
        "updated_at": now,
        "lease_until": None,
    }
    if give_up:
        values["state"] = "failed"
    else:
        delay = BACKOFF_SECONDS.get(owner_attempts, 8)
        values["state"] = "pending"
        values["available_at"] = now + timedelta(seconds=delay)
    if not _update_if_owner(session, job, owner_attempts, **values):
        return False
    if give_up and job.kind == "prepare_brief" and job.ticket_id:
        _mark_brief_failed(session, job, error)
    return True


async def process_job(
    session: Session,
    job: Job,
    agent: AgentPort,
    owner_attempts: int | None = None,
) -> None:
    if job.kind == "prepare_brief":
        await _process_prepare_brief(session, job, agent, owner_attempts)
        return
    from campus247.services.student import retry_handover

    retry_handover(session, job)


async def _process_prepare_brief(
    session: Session,
    job: Job,
    agent: AgentPort,
    owner_attempts: int | None,
) -> None:
    from campus247.db.models import HandoverPacket, IntakePacket, Message, StudentProfile

    owner_attempts = _bind_owner_attempts(session, job, owner_attempts)
    if owner_attempts is None:
        return
    ticket = _locked_ticket(session, job.ticket_id)
    if ticket is None:
        if _update_if_owner(
            session,
            job,
            owner_attempts,
            state="failed",
            last_error="ticket_missing",
            lease_until=None,
            updated_at=utcnow(),
        ):
            session.commit()
        else:
            session.rollback()
        return
    if job.source_revision != ticket.revision:
        if _update_if_owner(
            session,
            job,
            owner_attempts,
            state="cancelled",
            lease_until=None,
            updated_at=utcnow(),
        ):
            session.commit()
        else:
            session.rollback()
        return
    if not _extend_lease(session, job, owner_attempts):
        return

    profile = session.get(StudentProfile, ticket.student_id)
    messages = (
        session.execute(
            select(Message)
            .where(Message.conversation_id == ticket.conversation_id)
            .order_by(Message.created_at, Message.id)
        )
        .scalars()
        .all()
    )
    intake_row = (
        session.execute(
            select(IntakePacket).where(IntakePacket.ticket_id == ticket.id).order_by(IntakePacket.version.desc())
        )
        .scalars()
        .first()
    )
    handover_row = (
        session.execute(
            select(HandoverPacket)
            .where(HandoverPacket.ticket_id == ticket.id)
            .order_by(HandoverPacket.created_at.desc())
        )
        .scalars()
        .first()
    )
    from campus247.models.contracts_v1 import Handover, TicketSnapshot

    query = _brief_retrieval_query(ticket, intake_row, handover_row, messages)
    approved_sources = await _retrieve_approved_sources(session, job, owner_attempts, query)
    if approved_sources is None:
        return

    snapshot = TicketSnapshot(
        ticket=ticket_to_contract(ticket),
        source_ticket_revision=job.source_revision or ticket.revision,
        student_profile=profile_to_contract(profile) if profile is not None else _empty_profile(ticket.student_id),
        messages=[message_to_contract(item) for item in messages],
        intake_packet=intake_from_stored(intake_row.service_type, intake_row.fields)
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
        approved_sources=approved_sources,
        existing_officer_draft=ticket.officer_draft,
        request_id=job.id,
    )
    if not _extend_lease(session, job, owner_attempts):
        return
    try:
        brief = await agent.prepare_officer_brief(snapshot)
    except ModuleCallError as exc:
        await _fail_if_owner(session, job, owner_attempts, exc.error.code)
        return
    except Exception as exc:  # noqa: BLE001
        await _fail_if_owner(session, job, owner_attempts, type(exc).__name__)
        return

    await _publish_brief(session, job, agent, brief, owner_attempts)


def _store_brief(
    session: Session,
    ticket: Ticket,
    brief: BriefModel,
    job: Job,
    agent: AgentPort,
    *,
    current: bool,
    status: str,
) -> None:
    from campus247.db.models import FactProvenance

    meta = metadata_from_agent(agent)
    now = utcnow()
    if current:
        for row in session.execute(
            select(OfficerBrief).where(OfficerBrief.ticket_id == ticket.id, OfficerBrief.is_current.is_(True))
        ).scalars():
            row.is_current = False
            if row.status == "ready":
                row.status = "stale"
            row.updated_at = now
    latest = (
        session.execute(
            select(OfficerBrief).where(OfficerBrief.ticket_id == ticket.id).order_by(OfficerBrief.brief_version.desc())
        )
        .scalars()
        .first()
    )
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
        model_name=meta["model_name"],
        prompt_version=meta["prompt_version"],
        template_version=meta["template_version"],
        index_version=meta.get("index_version"),
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
    ticket = _locked_ticket(session, job.ticket_id)
    if ticket is None:
        return
    make_current = ticket.revision == (job.source_revision or ticket.revision)
    if make_current:
        for row in session.execute(
            select(OfficerBrief).where(OfficerBrief.ticket_id == ticket.id, OfficerBrief.is_current.is_(True))
        ).scalars():
            row.is_current = False
            if row.status == "ready":
                row.status = "stale"
            row.updated_at = now
    latest = (
        session.execute(
            select(OfficerBrief).where(OfficerBrief.ticket_id == ticket.id).order_by(OfficerBrief.brief_version.desc())
        )
        .scalars()
        .first()
    )
    version = (latest.brief_version + 1) if latest is not None else 1
    session.add(
        OfficerBrief(
            id=new_id("brf"),
            ticket_id=ticket.id,
            brief_version=version,
            source_ticket_revision=job.source_revision or ticket.revision,
            status="failed",
            is_current=make_current,
            error=_brief_error_payload(error, job.id),
            created_at=now,
            updated_at=now,
        )
    )
    if make_current:
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


def _brief_error_payload(error: str, request_id: str) -> dict[str, object]:
    code = error if error in MODULE_ERROR_CODES else "PROVIDER_UNAVAILABLE"
    return {
        "code": code,
        "retryable": code in RETRYABLE_MODULE_CODES,
        "stage": "brief",
        "request_id": request_id,
    }


def _brief_retrieval_query(ticket: Ticket, intake_row, handover_row, messages) -> str:
    parts = [ticket.summary or "", ticket.service_type or ""]
    fields = getattr(intake_row, "fields", None) if intake_row is not None else None
    if isinstance(fields, dict):
        parts.extend(str(value) for value in fields.values() if value)
    if handover_row is not None:
        parts.append(getattr(handover_row, "risk_type", "") or "")
        parts.append(getattr(handover_row, "summary", "") or "")
    for item in messages[-5:]:
        content = getattr(item, "content", None)
        if content:
            parts.append(str(content)[:400])
    query = " ".join(part for part in parts if part).strip()
    return (query or "quy chế học vụ demo")[:5000]


def _locked_ticket(session: Session, ticket_id: str | None) -> Ticket | None:
    if not ticket_id:
        return None
    stmt = select(Ticket).where(Ticket.id == ticket_id).execution_options(populate_existing=True)
    return session.execute(lock_select(session, stmt)).scalar_one_or_none()


def _before_ownership_write() -> Awaitable[None] | None:
    """Test hook. Runs after prior work is committed and before the ownership UPDATE."""
    return None


async def _await_before_ownership_write() -> None:
    result = _before_ownership_write()
    if inspect.isawaitable(result):
        await result


def _bind_owner_attempts(session: Session, job: Job, owner_attempts: int | None) -> int | None:
    """Bind the lease token captured at claim time.

    A passed token is valid only while the row is still leased with that attempt.
    Pending retry rows must be claimed again through lease_next_job.
    """
    if owner_attempts is None:
        if job.state == "pending":
            now = utcnow()
            job.state = "leased"
            if job.attempts < 1:
                job.attempts = 1
            job.lease_until = now + timedelta(seconds=get_settings().worker_lease_seconds)
            job.updated_at = now
            session.flush()
        elif job.state != "leased":
            return None
        return job.attempts
    session.refresh(job)
    if job.state != "leased" or job.attempts != owner_attempts:
        return None
    return owner_attempts


def _update_if_owner(session: Session, job: Job, owner_attempts: int, **values: object) -> bool:
    """Apply values only while this worker owns the lease. Same transaction as the caller."""
    result = session.execute(
        update(Job)
        .where(Job.id == job.id, Job.state == "leased", Job.attempts == owner_attempts)
        .values(**values)
        .execution_options(synchronize_session="fetch")
    )
    if result.rowcount != 1:
        return False
    session.refresh(job)
    return True


def _extend_lease(session: Session, job: Job, owner_attempts: int) -> bool:
    session.commit()
    if not heartbeat(session, job, owner_attempts):
        session.rollback()
        return False
    session.commit()
    return True


async def _fail_if_owner(session: Session, job: Job, owner_attempts: int, error: str) -> None:
    session.commit()
    await _await_before_ownership_write()
    if not fail_or_retry(session, job, error, owner_attempts):
        session.rollback()
        return
    session.commit()


def _retrieval_timeout_seconds(job: Job) -> float:
    settings = get_settings()
    timeout = float(settings.worker_retrieval_timeout_seconds)
    if job.lease_until is None:
        return timeout
    remaining = (job.lease_until - utcnow()).total_seconds()
    return max(0.1, min(timeout, remaining))


async def _retrieve_approved_sources(session: Session, job: Job, owner_attempts: int, query: str) -> list | None:
    from campus247.services.runtime import get_rag

    try:
        retrieval = await asyncio.wait_for(
            get_rag().retrieve_policy(
                RetrievalRequest(
                    query=query,
                    policy_scope="demo_academic",
                    top_k=5,
                    effective_at=utcnow(),
                )
            ),
            timeout=_retrieval_timeout_seconds(job),
        )
    except TimeoutError:
        await _fail_if_owner(session, job, owner_attempts, "PROVIDER_TIMEOUT")
        return None
    except ModuleCallError as exc:
        await _fail_if_owner(session, job, owner_attempts, exc.error.code)
        return None
    except Exception as exc:  # noqa: BLE001
        await _fail_if_owner(session, job, owner_attempts, type(exc).__name__)
        return None
    if not _extend_lease(session, job, owner_attempts):
        return None
    return list(retrieval.passages) if retrieval.status == "found" else []


async def _publish_brief(
    session: Session, job: Job, agent: AgentPort, brief: BriefModel, owner_attempts: int
) -> None:
    session.commit()
    await _await_before_ownership_write()
    now = utcnow()
    if not _update_if_owner(
        session,
        job,
        owner_attempts,
        state="succeeded",
        lease_until=None,
        updated_at=now,
    ):
        session.rollback()
        return
    ticket = _locked_ticket(session, job.ticket_id)
    if ticket is None:
        job.state = "failed"
        job.last_error = "ticket_missing"
        job.updated_at = utcnow()
        session.commit()
        return
    if ticket.revision != job.source_revision:
        _store_brief(session, ticket, brief, job, agent, current=False, status="stale")
        session.commit()
        return
    _store_brief(session, ticket, brief, job, agent, current=True, status="ready")
    _audit_brief(session, ticket, "brief_ready", job.id)
    session.commit()


def _empty_profile(student_id: str):
    from campus247.models.contracts_v1 import Profile

    return Profile(student_id=student_id, full_name=None, mssv=None, faculty=None, cohort=None, is_demo=True)


def mark_briefs_stale(session: Session, ticket_id: str) -> None:
    now = utcnow()
    for row in session.execute(
        select(OfficerBrief).where(OfficerBrief.ticket_id == ticket_id, OfficerBrief.is_current.is_(True))
    ).scalars():
        if row.status in {"ready", "pending", "processing"}:
            row.status = "stale"
        row.updated_at = now
