from sqlalchemy import case, func, or_, select
from sqlalchemy.orm import Session

from campus247.db.models import AuditEntry, Message, OfficerAction, OfficerBrief, Ticket, TicketAssignment, User
from campus247.models import contracts_v1 as c
from campus247.services.access import active_team_ids, get_visible_ticket, require_officer, require_student
from campus247.services.common import new_id, paginate, parse_page, stale_revision, utcnow
from campus247.services.errors import ApiError, not_found, validation
from campus247.services.idempotency import assert_replay_allowed, begin_idempotent, complete_idempotent, processing_body
from campus247.services.jobs import enqueue_prepare_brief
from campus247.services.serializers import (
    audit_to_contract,
    brief_envelope,
    message_to_contract,
    ticket_to_contract,
)
from campus247.services.student import _add_message, _audit


def list_student_tickets(
    session: Session,
    actor: User,
    page: int | None,
    page_size: int | None,
    status: str | None,
    search: str | None,
) -> c.Page[c.Ticket]:
    require_student(actor)
    page, page_size = parse_page(page, page_size)
    query = select(Ticket).where(Ticket.student_id == actor.id)
    query = _apply_ticket_filters(query, status=status, search=search)
    return _page_tickets(session, query.order_by(Ticket.updated_at.desc(), Ticket.id.desc()), page, page_size)


def list_officer_tickets(
    session: Session,
    actor: User,
    page: int | None,
    page_size: int | None,
    status: str | None,
    priority: str | None,
    category: str | None,
    search: str | None,
) -> c.Page[c.Ticket]:
    require_officer(actor)
    page, page_size = parse_page(page, page_size)
    teams = active_team_ids(session, actor)
    if not teams:
        return paginate([], 0, page, page_size)
    query = select(Ticket).where(Ticket.team_id.in_(teams))
    query = _apply_ticket_filters(query, status=status, priority=priority, category=category, search=search)
    priority_rank = case((Ticket.priority == "high", 0), else_=1)
    return _page_tickets(
        session, query.order_by(priority_rank, Ticket.created_at.asc(), Ticket.id.asc()), page, page_size
    )


def get_ticket_detail(
    session: Session, actor: User, ticket_id: str, page: int | None, page_size: int | None
) -> c.TicketDetail:
    ticket = get_visible_ticket(session, actor, ticket_id)
    page, page_size = parse_page(page or 1, page_size or 20)
    query = select(Message).where(Message.ticket_id == ticket.id)
    total = session.execute(select(func.count()).select_from(query.subquery())).scalar_one()
    latest = (
        session.execute(
            query.order_by(Message.created_at.desc(), Message.id.desc()).offset((page - 1) * page_size).limit(page_size)
        )
        .scalars()
        .all()
    )
    items = [message_to_contract(row) for row in reversed(list(latest))]
    return c.TicketDetail(ticket=ticket_to_contract(ticket), messages=paginate(items, total, page, page_size))


def list_ticket_messages(
    session: Session, actor: User, ticket_id: str, page: int | None, page_size: int | None
) -> c.Page[c.Message]:
    ticket = get_visible_ticket(session, actor, ticket_id)
    page, page_size = parse_page(page, page_size)
    query = select(Message).where(Message.ticket_id == ticket.id)
    total = session.execute(select(func.count()).select_from(query.subquery())).scalar_one()
    rows = (
        session.execute(
            query.order_by(Message.created_at.asc(), Message.id.asc()).offset((page - 1) * page_size).limit(page_size)
        )
        .scalars()
        .all()
    )
    return paginate([message_to_contract(row) for row in rows], total, page, page_size)


def get_brief(session: Session, actor: User, ticket_id: str) -> c.BriefEnvelope:
    require_officer(actor)
    ticket = get_visible_ticket(session, actor, ticket_id)
    brief = (
        session.execute(
            select(OfficerBrief)
            .where(OfficerBrief.ticket_id == ticket.id)
            .order_by(OfficerBrief.is_current.desc(), OfficerBrief.brief_version.desc())
        )
        .scalars()
        .first()
    )
    return brief_envelope(ticket, brief)


def prepare_brief(
    session: Session, actor: User, ticket_id: str, body: c.PrepareRequest, idempotency_key: str, request_id: str
) -> tuple[int, dict]:
    require_officer(actor)
    handle = begin_idempotent(
        session,
        actor=actor,
        operation="prepare_brief",
        resource_id=ticket_id,
        key=idempotency_key,
        payload=body.model_dump(mode="json"),
    )
    if handle.outcome == "replay":
        assert_replay_allowed(actor, "prepare_brief", lambda: get_visible_ticket(session, actor, ticket_id))
        session.commit()
        return handle.http_status or 202, handle.body or {}
    if handle.outcome == "processing":
        session.commit()
        return 202, processing_body(handle.record.id)
    ticket = get_visible_ticket(session, actor, ticket_id, for_update=True)
    if ticket.status == "resolved":
        raise ApiError(409, "TICKET_CLOSED", "Không chuẩn bị hồ sơ cho yêu cầu đã đóng.")
    if ticket.revision != body.expected_revision:
        raise stale_revision(ticket.revision)
    job = enqueue_prepare_brief(session, ticket)
    accepted = c.JobAccepted(
        job_id=job.id,
        ticket_id=ticket.id,
        source_ticket_revision=job.source_revision or ticket.revision,
        status="processing" if job.state == "leased" else "pending",  # type: ignore[arg-type]
    )
    body_out = accepted.model_dump(mode="json")
    complete_idempotent(session, handle.record, 202, body_out)
    session.commit()
    return 202, body_out


def claim_ticket(
    session: Session, actor: User, ticket_id: str, body: c.ClaimRequest, idempotency_key: str, request_id: str
) -> tuple[int, dict]:
    require_officer(actor)
    handle = begin_idempotent(
        session,
        actor=actor,
        operation="claim",
        resource_id=ticket_id,
        key=idempotency_key,
        payload=body.model_dump(mode="json"),
    )
    if handle.outcome == "replay":
        assert_replay_allowed(actor, "claim", lambda: get_visible_ticket(session, actor, ticket_id))
        session.commit()
        return handle.http_status or 200, handle.body or {}
    if handle.outcome == "processing":
        session.commit()
        return 202, processing_body(handle.record.id)
    ticket = get_visible_ticket(session, actor, ticket_id, for_update=True)
    if ticket.status == "resolved":
        raise ApiError(409, "TICKET_CLOSED", "Không nhận ca đã đóng.")
    if ticket.revision != body.expected_revision:
        raise stale_revision(ticket.revision)
    teams = active_team_ids(session, actor)
    if ticket.team_id not in teams:
        raise not_found()
    if ticket.assigned_officer_id == actor.id:
        last = (
            session.execute(
                select(AuditEntry)
                .where(AuditEntry.ticket_id == ticket.id, AuditEntry.action == "claim")
                .order_by(AuditEntry.created_at.desc())
            )
            .scalars()
            .first()
        )
        if last is None:
            last = _audit(
                session,
                ticket,
                actor.id,
                "officer",
                "claim",
                ticket.status,
                ticket.status,
                request_id,
                utcnow(),
            )
        body_out = c.ClaimResult(ticket=ticket_to_contract(ticket), audit_id=last.id).model_dump(mode="json")
        complete_idempotent(session, handle.record, 200, body_out)
        session.commit()
        return 200, body_out
    if ticket.assigned_officer_id is not None:
        raise ApiError(409, "INVALID_STATUS_TRANSITION", "Ca đã được cán bộ khác nhận.")
    now = utcnow()
    previous = ticket.assigned_officer_id
    ticket.assigned_officer_id = actor.id
    ticket.revision += 1
    ticket.updated_at = now
    session.add(
        TicketAssignment(
            id=new_id("asg"),
            ticket_id=ticket.id,
            team_id=ticket.team_id,
            officer_id=actor.id,
            previous_officer_id=previous,
            assigned_by=actor.id,
            action="claim",
            assigned_at=now,
            is_demo=True,
        )
    )
    audit = _audit(session, ticket, actor.id, "officer", "claim", ticket.status, ticket.status, request_id, now)
    body_out = c.ClaimResult(ticket=ticket_to_contract(ticket), audit_id=audit.id).model_dump(mode="json")
    complete_idempotent(session, handle.record, 200, body_out)
    session.commit()
    return 200, body_out


def submit2(
    session: Session, actor: User, ticket_id: str, body: c.Submit2, idempotency_key: str, request_id: str
) -> tuple[int, dict]:
    require_officer(actor)
    handle = begin_idempotent(
        session,
        actor=actor,
        operation="submit2",
        resource_id=ticket_id,
        key=idempotency_key,
        payload=body.model_dump(mode="json"),
    )
    if handle.outcome == "replay":
        assert_replay_allowed(actor, "submit2", lambda: get_visible_ticket(session, actor, ticket_id))
        session.commit()
        return handle.http_status or 200, handle.body or {}
    if handle.outcome == "processing":
        session.commit()
        return 202, processing_body(handle.record.id)
    ticket = get_visible_ticket(session, actor, ticket_id, for_update=True)
    if ticket.status == "resolved":
        raise ApiError(409, "TICKET_CLOSED", "Yêu cầu đã đóng.")
    if ticket.revision != body.expected_revision:
        raise stale_revision(ticket.revision)
    if ticket.assigned_officer_id != actor.id:
        raise ApiError(409, "INVALID_STATUS_TRANSITION", "Cần nhận ca trước khi xử lý.")
    if body.reviewed_brief_version is not None:
        brief = session.execute(
            select(OfficerBrief).where(
                OfficerBrief.ticket_id == ticket.id,
                OfficerBrief.brief_version == body.reviewed_brief_version,
            )
        ).scalar_one_or_none()
        current = (
            session.execute(
                select(OfficerBrief).where(OfficerBrief.ticket_id == ticket.id, OfficerBrief.is_current.is_(True))
            )
            .scalars()
            .first()
        )
        if (
            brief is None
            or current is None
            or brief.brief_version != current.brief_version
            or brief.source_ticket_revision != ticket.revision
            or brief.status == "stale"
        ):
            raise ApiError(409, "STALE_BRIEF", "Hồ sơ AI đã thay đổi. Tải lại hoặc xử lý thủ công.")
    now = utcnow()
    from_status = ticket.status
    if body.action == "resolve":
        ticket.status = "resolved"
        conversation = ticket.conversation
        conversation.status = "closed"
        conversation.updated_at = now
    else:
        ticket.status = "pending_officer"
    ticket.revision += 1
    ticket.updated_at = now
    ticket.officer_draft = body.content
    session.add(
        OfficerAction(
            id=new_id("act"),
            ticket_id=ticket.id,
            actor_id=actor.id,
            action=body.action,
            content=body.content,
            expected_revision=body.expected_revision,
            reviewed_brief_version=body.reviewed_brief_version,
            created_at=now,
        )
    )
    message = _add_message(session, ticket.conversation, "officer", body.content, actor.id, ticket.id, now)
    audit = _audit(session, ticket, actor.id, "officer", body.action, from_status, ticket.status, request_id, now)
    result = c.Submit2Result(ticket=ticket_to_contract(ticket), message=message_to_contract(message), audit_id=audit.id)
    body_out = result.model_dump(mode="json")
    complete_idempotent(session, handle.record, 200, body_out)
    session.commit()
    return 200, body_out


def list_audit(
    session: Session, actor: User, ticket_id: str, page: int | None, page_size: int | None
) -> c.Page[c.AuditEntry]:
    require_officer(actor)
    ticket = get_visible_ticket(session, actor, ticket_id)
    page, page_size = parse_page(page, page_size)
    query = select(AuditEntry).where(AuditEntry.ticket_id == ticket.id)
    total = session.execute(select(func.count()).select_from(query.subquery())).scalar_one()
    rows = (
        session.execute(
            query.order_by(AuditEntry.created_at.asc(), AuditEntry.id.asc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        .scalars()
        .all()
    )
    return paginate([audit_to_contract(row) for row in rows], total, page, page_size)


def _apply_ticket_filters(query, *, status=None, priority=None, category=None, search=None):
    allowed_status = {"open", "pending_officer", "resolved"}
    allowed_priority = {"normal", "high"}
    allowed_category = {"action", "complaint"}
    if status is not None:
        if status not in allowed_status:
            raise validation("status không hợp lệ.")
        query = query.where(Ticket.status == status)
    if priority is not None:
        if priority not in allowed_priority:
            raise validation("priority không hợp lệ.")
        query = query.where(Ticket.priority == priority)
    if category is not None:
        if category not in allowed_category:
            raise validation("category không hợp lệ.")
        query = query.where(Ticket.category == category)
    if search:
        if len(search) > 100:
            raise validation("search tối đa 100 ký tự.")
        pattern = f"%{search.lower()}%"
        query = query.where(or_(func.lower(Ticket.code).like(pattern), func.lower(Ticket.summary).like(pattern)))
    return query


def _page_tickets(session, query, page, page_size) -> c.Page[c.Ticket]:
    total = session.execute(select(func.count()).select_from(query.subquery())).scalar_one()
    rows = session.execute(query.offset((page - 1) * page_size).limit(page_size)).scalars().all()
    return paginate([ticket_to_contract(row) for row in rows], total, page, page_size)
