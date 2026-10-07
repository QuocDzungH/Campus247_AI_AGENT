from sqlalchemy import case, func, or_, select
from sqlalchemy.orm import Session, selectinload

from campus247.db.models import (
    AuditEntry,
    IssuedDocument,
    Message,
    OfficerAction,
    OfficerBrief,
    StudentProfile,
    Ticket,
    TicketAssignment,
    TicketAttachment,
    User,
)
from campus247.models import contracts_v1 as c
from campus247.services.access import active_team_ids, get_visible_ticket, require_officer, require_student
from campus247.services.common import new_id, paginate, parse_page, stale_revision, utcnow
from campus247.services.documents import (
    draft_view,
    ensure_draft,
    institution_info,
    issue_document,
    issued_view,
    open_issued,
    patch_draft,
)
from campus247.services.errors import ApiError, not_found, validation
from campus247.services.idempotency import assert_replay_allowed, begin_idempotent, complete_idempotent, processing_body
from campus247.services.jobs import enqueue_prepare_brief
from campus247.services.process_catalog import get_process, process_info
from campus247.services.serializers import (
    audit_to_contract,
    brief_envelope,
    message_to_contract,
    profile_view,
    ticket_to_contract,
    user_to_contract,
)
from campus247.services.student import _add_message, _audit
from campus247.services.verification import record_officer_review, run_pipeline


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
    query = select(Ticket).options(selectinload(Ticket.student).selectinload(User.profile)).where(Ticket.student_id == actor.id)
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
    query = (
        select(Ticket)
        .options(selectinload(Ticket.student).selectinload(User.profile))
        .where(Ticket.team_id.in_(teams))
    )
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
    rows = (
        session.execute(
            query.order_by(Message.created_at.asc(), Message.id.asc()).offset((page - 1) * page_size).limit(page_size)
        )
        .scalars()
        .all()
    )
    items = [message_to_contract(row) for row in rows]
    from campus247.services.files import attachment_to_contract

    attachments = [
        attachment_to_contract(row)
        for row in session.execute(
            select(TicketAttachment)
            .where(TicketAttachment.ticket_id == ticket.id)
            .order_by(TicketAttachment.created_at)
        ).scalars()
    ]
    workspace = c.TicketWorkspace(
        ticket_id=ticket.id,
        revision=ticket.revision,
        officer_draft=ticket.officer_draft,
        checklist=[c.OfficerChecklistItem.model_validate(_checklist_item(item)) for item in (ticket.officer_checklist or [])],
    )
    profile = session.get(StudentProfile, ticket.student_id)
    assignee = session.get(User, ticket.assigned_officer_id) if ticket.assigned_officer_id else None
    issued = session.execute(select(IssuedDocument).where(IssuedDocument.ticket_id == ticket.id)).scalar_one_or_none()
    return c.TicketDetail(
        ticket=ticket_to_contract(ticket),
        messages=paginate(items, total, page, page_size),
        attachments=attachments,
        workspace=workspace,
        verifications=_safe_verifications(ticket.system_verifications),
        student_profile=profile_view(profile) if profile is not None else None,
        assigned_officer=user_to_contract(assignee) if assignee is not None else None,
        process=c.ProcessInfo.model_validate(process_info(ticket.service_type)),
        document_draft=draft_view(ticket),
        issued_document=issued_view(issued),
        supplements=_safe_supplements(ticket.supplement_requests),
        evidence_fingerprint=ticket.evidence_fingerprint,
        institution=institution_info(),
    )


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
    _audit(
        session,
        ticket,
        actor.id,
        "officer",
        "prepare",
        ticket.status,
        ticket.status,
        request_id,
        utcnow(),
        details={"job_id": job.id, "source_revision": job.source_revision or ticket.revision},
    )
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
        _ensure_process_checklist(ticket)
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
    _ensure_process_checklist(ticket)
    ensure_draft(session, ticket, actor)
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
    if body.action == "request_info":
        ticket.supplement_requests = _append_supplement(ticket, actor, body)
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
    actor_ids = {row.actor_id for row in rows if row.actor_id}
    names: dict[str, str] = {}
    if actor_ids:
        names = {
            user.id: user.name
            for user in session.execute(select(User).where(User.id.in_(actor_ids))).scalars()
        }
    return paginate([audit_to_contract(row, names.get(row.actor_id) if row.actor_id else None) for row in rows], total, page, page_size)


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


def _safe_verifications(rows) -> list[c.SystemVerificationItem]:
    allowed = set(c.SystemVerificationItem.model_fields)
    items: list[c.SystemVerificationItem] = []
    for item in rows or []:
        if not isinstance(item, dict):
            continue
        payload = {key: value for key, value in item.items() if key in allowed}
        try:
            items.append(c.SystemVerificationItem.model_validate(payload))
        except Exception:
            continue
    return items


def _safe_supplements(rows) -> list[c.SupplementView]:
    items: list[c.SupplementView] = []
    for item in rows or []:
        if not isinstance(item, dict):
            continue
        try:
            items.append(c.SupplementView.model_validate(item))
        except Exception:
            continue
    return items


def _workspace_view(ticket: Ticket) -> c.TicketWorkspace:
    return c.TicketWorkspace(
        ticket_id=ticket.id,
        revision=ticket.revision,
        officer_draft=ticket.officer_draft,
        checklist=[c.OfficerChecklistItem.model_validate(_checklist_item(item)) for item in (ticket.officer_checklist or [])],
    )


def _require_assignee(ticket: Ticket, actor: User) -> None:
    if ticket.assigned_officer_id != actor.id:
        raise ApiError(409, "INVALID_STATUS_TRANSITION", "Cần nhận ca trước khi xử lý.")


def _checklist_item(item: dict) -> dict:
    if not isinstance(item, dict):
        return {"id": "unknown", "label": "unknown", "checked": False}
    return {
        "id": item.get("id"),
        "label": item.get("label"),
        "checked": bool(item.get("checked")),
        "required": bool(item.get("required")),
        "source": item.get("source") if item.get("source") in {"process", "ai"} else "process",
        "description": item.get("description"),
        "checked_by": item.get("checked_by"),
        "checked_at": item.get("checked_at"),
        "note": item.get("note"),
        "source_version": item.get("source_version"),
    }


def _ensure_process_checklist(ticket: Ticket) -> None:
    spec = get_process(ticket.service_type)
    existing = [dict(item) for item in (ticket.officer_checklist or []) if isinstance(item, dict)]
    by_id = {item.get("id"): item for item in existing if item.get("id")}
    merged = []
    for item in spec.required_checklist:
        current = by_id.get(item["id"]) or {}
        merged.append(
            {
                "id": item["id"],
                "label": item["label"],
                "checked": bool(current.get("checked")),
                "required": True,
                "source": "process",
                "source_version": spec.process_version,
                "checked_by": current.get("checked_by"),
                "checked_at": current.get("checked_at"),
                "note": current.get("note"),
            }
        )
    for item in existing:
        if item.get("id") and item.get("id") not in {row["id"] for row in merged}:
            merged.append({**item, "required": bool(item.get("required")), "source": item.get("source") or "ai"})
    ticket.officer_checklist = merged


def _append_supplement(ticket: Ticket, actor: User, body: c.Submit2) -> list[dict]:
    now = utcnow().isoformat()
    items = []
    if body.supplement_items:
        items = [
            {
                "id": entry.id or new_id("spi"),
                "label": entry.label,
                "reason": entry.reason,
                "status": "open",
            }
            for entry in body.supplement_items
        ]
    else:
        items = [{"id": new_id("spi"), "label": "Bổ sung thông tin theo phản hồi cán bộ", "reason": body.content, "status": "open"}]
    row = {
        "id": new_id("sup"),
        "items": items,
        "reason": body.content,
        "status": "open",
        "requested_by": actor.id,
        "requested_at": now,
        "evidence_fingerprint": ticket.evidence_fingerprint,
    }
    current = [dict(item) for item in (ticket.supplement_requests or []) if isinstance(item, dict)]
    current.append(row)
    return current


def update_workspace(session: Session, actor: User, ticket_id: str, body: c.TicketWorkspacePatch) -> c.TicketWorkspace:
    require_officer(actor)
    ticket = get_visible_ticket(session, actor, ticket_id, for_update=True)
    if ticket.status == "resolved":
        raise ApiError(409, "TICKET_CLOSED", "Không sửa nháp hồ sơ đã đóng.")
    _require_assignee(ticket, actor)
    if body.expected_revision is not None and body.expected_revision != ticket.revision:
        raise stale_revision(ticket.revision)
    now = utcnow()
    if body.officer_draft is not None:
        ticket.officer_draft = body.officer_draft
    if body.ensure_process_checklist:
        _ensure_process_checklist(ticket)
    checklist = [dict(item) for item in (ticket.officer_checklist or [])]
    if body.checklist is not None:
        checklist = [item.model_dump(mode="json") for item in body.checklist]
    if body.toggle_checklist_id:
        if not checklist:
            _ensure_process_checklist(ticket)
            brief = (
                session.execute(
                    select(OfficerBrief).where(
                        OfficerBrief.ticket_id == ticket.id, OfficerBrief.is_current.is_(True)
                    )
                )
                .scalars()
                .first()
            )
            checklist = [dict(item) for item in (ticket.officer_checklist or [])]
            if brief is not None:
                existing_ids = {item.get("id") for item in checklist}
                for item in brief.checklist or []:
                    if isinstance(item, dict) and item.get("id") and item.get("id") not in existing_ids:
                        checklist.append(
                            {
                                "id": item.get("id"),
                                "label": item.get("label"),
                                "checked": False,
                                "required": False,
                                "source": "ai",
                                "source_version": brief.template_version,
                            }
                        )
        found = False
        next_items = []
        for item in checklist:
            if item.get("id") == body.toggle_checklist_id:
                found = True
                checked = not bool(item.get("checked"))
                next_items.append(
                    {
                        **item,
                        "checked": checked,
                        "checked_by": actor.id if checked else None,
                        "checked_at": now.isoformat() if checked else None,
                        "note": body.checklist_note or item.get("note"),
                    }
                )
            else:
                next_items.append(item)
        if not found:
            raise not_found()
        checklist = next_items
    ticket.officer_checklist = checklist
    ticket.updated_at = now
    _audit(
        session,
        ticket,
        actor.id,
        "officer",
        "workspace_update",
        ticket.status,
        ticket.status,
        "workspace",
        now,
        details={"revision": ticket.revision},
    )
    session.commit()
    return _workspace_view(ticket)


def run_ticket_verification(
    session: Session, actor: User, ticket_id: str, body: c.VerificationRunRequest | None = None
) -> list[c.SystemVerificationItem]:
    require_officer(actor)
    ticket = get_visible_ticket(session, actor, ticket_id, for_update=True)
    _require_assignee(ticket, actor)
    if ticket.status == "resolved":
        raise ApiError(409, "TICKET_CLOSED", "Không đối soát hồ sơ đã đóng.")
    if body and body.expected_revision is not None and body.expected_revision != ticket.revision:
        raise stale_revision(ticket.revision)
    items = run_pipeline(session, ticket, only_key=body.criterion_key if body else None)
    _audit(
        session,
        ticket,
        actor.id,
        "officer",
        "verification",
        ticket.status,
        ticket.status,
        "verification",
        utcnow(),
        details={"criterion_key": body.criterion_key if body else None, "revision": ticket.revision},
    )
    session.commit()
    return [c.SystemVerificationItem.model_validate(item) for item in items]


def confirm_ticket_verification(
    session: Session,
    actor: User,
    ticket_id: str,
    criterion_id: str,
    note: str | None,
    *,
    expected_revision: int | None = None,
    outcome: str = "viewed",
) -> list[c.SystemVerificationItem]:
    require_officer(actor)
    ticket = get_visible_ticket(session, actor, ticket_id, for_update=True)
    _require_assignee(ticket, actor)
    if expected_revision is not None and expected_revision != ticket.revision:
        raise stale_revision(ticket.revision)
    if outcome == "manual_pass" and not (note or "").strip():
        raise validation("Cần ghi chú bằng chứng khi đối chiếu thủ công.")
    items = [dict(item) for item in (ticket.system_verifications or [])]
    try:
        items = record_officer_review(items, criterion_id, actor_id=actor.id, note=note, resolution=outcome)
    except KeyError:
        raise not_found() from None
    except ValueError:
        raise ApiError(409, "STALE_REVISION", "Kết quả đối soát đã cũ. Hãy chạy lại trước khi ghi nhận.") from None
    ticket.system_verifications = items
    ticket.updated_at = utcnow()
    _audit(
        session,
        ticket,
        actor.id,
        "officer",
        "verification",
        ticket.status,
        ticket.status,
        "verification",
        utcnow(),
        details={"criterion_id": criterion_id, "outcome": outcome, "revision": ticket.revision},
    )
    session.commit()
    return [c.SystemVerificationItem.model_validate(item) for item in items]


def save_document_draft(
    session: Session, actor: User, ticket_id: str, body: c.DocumentDraftPatch
) -> c.DocumentDraftView:
    require_officer(actor)
    ticket = get_visible_ticket(session, actor, ticket_id, for_update=True)
    _require_assignee(ticket, actor)
    if ticket.status == "resolved":
        raise ApiError(409, "TICKET_CLOSED", "Không sửa bản thảo hồ sơ đã đóng.")
    if ticket.revision != body.expected_revision:
        raise stale_revision(ticket.revision)
    ensure_draft(session, ticket, actor)
    draft = patch_draft(ticket, actor, body)
    ticket.revision += 1
    _audit(
        session,
        ticket,
        actor.id,
        "officer",
        "document_draft",
        ticket.status,
        ticket.status,
        "document",
        utcnow(),
        details={"draft_version": draft.get("version")},
    )
    session.commit()
    view = draft_view(ticket)
    if view is None:
        raise not_found()
    return view


def issue_ticket_document(
    session: Session, actor: User, ticket_id: str, body: c.IssueDocumentRequest, idempotency_key: str, request_id: str
) -> tuple[int, dict]:
    require_officer(actor)
    handle = begin_idempotent(
        session,
        actor=actor,
        operation="issue_document",
        resource_id=ticket_id,
        key=idempotency_key,
        payload=body.model_dump(mode="json"),
    )
    if handle.outcome == "replay":
        session.commit()
        return handle.http_status or 200, handle.body or {}
    if handle.outcome == "processing":
        session.commit()
        return 202, processing_body(handle.record.id)
    ticket = get_visible_ticket(session, actor, ticket_id, for_update=True)
    if ticket.status == "resolved":
        raise ApiError(409, "TICKET_CLOSED", "Không phát hành trên hồ sơ đã đóng.")
    if ticket.revision != body.expected_revision:
        raise stale_revision(ticket.revision)
    _require_assignee(ticket, actor)
    row = issue_document(session, ticket, actor, body.expected_draft_version)
    audit = _audit(
        session,
        ticket,
        actor.id,
        "officer",
        "document_issue",
        ticket.status,
        ticket.status,
        request_id,
        utcnow(),
        details={
            "document_id": row.id,
            "sha256": row.sha256,
            "draft_version": row.draft_version,
            "signature_status": row.signature_status,
            "official": False,
        },
    )
    view = issued_view(row)
    if view is None:
        raise not_found()
    body_out = c.IssueDocumentResult(
        document=view, ticket=ticket_to_contract(ticket), audit_id=audit.id
    ).model_dump(mode="json")
    complete_idempotent(session, handle.record, 200, body_out)
    session.commit()
    return 200, body_out


def download_issued_document(session: Session, actor: User, ticket_id: str, document_id: str):
    ticket = get_visible_ticket(session, actor, ticket_id)
    return open_issued(session, actor, ticket, document_id)
