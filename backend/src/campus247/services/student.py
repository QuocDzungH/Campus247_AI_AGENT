from datetime import timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from campus247.config import get_settings
from campus247.db.models import (
    AuditEntry,
    Conversation,
    HandoverPacket,
    IntakeOperation,
    IntakePacket,
    Message,
    MessageCitation,
    Preview,
    PreviewRevision,
    SafetyDecision,
    StudentProfile,
    Team,
    Ticket,
    User,
)
from campus247.models import contracts_v1 as c
from campus247.models.ports_v1 import AgentPort
from campus247.services.access import (
    get_visible_conversation,
    lock_conversation,
    require_student,
    ticket_for_conversation,
)
from campus247.services.common import (
    MSG_FORWARDED,
    MSG_HANDOVER,
    MSG_SUPPLEMENT,
    RISK_ROUTING,
    SERVICE_TEAM,
    hash_payload,
    new_id,
    next_message_seq,
    next_ticket_code,
    paginate,
    parse_page,
    utcnow,
)
from campus247.services.errors import ApiError, not_found, persistence_unavailable, validation
from campus247.services.idempotency import begin_idempotent, complete_idempotent, processing_body
from campus247.services.jobs import enqueue_prepare_brief, enqueue_retry_handover, mark_briefs_stale
from campus247.services.serializers import (
    conversation_state,
    conversation_to_contract,
    message_to_contract,
    preview_to_contract,
    profile_to_contract,
    ticket_ref,
    ticket_to_contract,
)


def create_conversation(session: Session, actor: User, idempotency_key: str, request_id: str) -> tuple[int, dict]:
    require_student(actor)
    handle = begin_idempotent(
        session, actor=actor, operation="create_conversation", resource_id=actor.id, key=idempotency_key, payload={}
    )
    if handle.outcome == "replay":
        return handle.http_status or 201, handle.body or {}
    if handle.outcome == "processing":
        return 202, processing_body(handle.record.id)
    now = utcnow()
    conversation = Conversation(
        id=new_id("conv"),
        owner_id=actor.id,
        status="active",
        ai_response_locked=False,
        handover_status="none",
        revision=1,
        created_at=now,
        updated_at=now,
    )
    session.add(conversation)
    session.flush()
    body = conversation_to_contract(conversation, None).model_dump(mode="json")
    complete_idempotent(session, handle.record, 201, body)
    session.commit()
    return 201, body


def list_conversations(
    session: Session, actor: User, page: int | None, page_size: int | None
) -> c.Page[c.Conversation]:
    require_student(actor)
    page, page_size = parse_page(page, page_size)
    query = select(Conversation).where(Conversation.owner_id == actor.id)
    total = session.execute(select(func.count()).select_from(query.subquery())).scalar_one()
    rows = (
        session.execute(
            query.order_by(Conversation.updated_at.desc(), Conversation.id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        .scalars()
        .all()
    )
    items = []
    for row in rows:
        ticket = ticket_for_conversation(session, row.id)
        items.append(conversation_to_contract(row, ticket.id if ticket else None))
    return paginate(items, total, page, page_size)


def list_messages(
    session: Session, actor: User, conversation_id: str, page: int | None, page_size: int | None
) -> c.Page[c.Message]:
    get_visible_conversation(session, actor, conversation_id)
    page, page_size = parse_page(page, page_size)
    query = select(Message).where(Message.conversation_id == conversation_id)
    total = session.execute(select(func.count()).select_from(query.subquery())).scalar_one()
    rows = (
        session.execute(
            query.order_by(Message.created_at.asc(), Message.id.asc()).offset((page - 1) * page_size).limit(page_size)
        )
        .scalars()
        .all()
    )
    return paginate([message_to_contract(row) for row in rows], total, page, page_size)


async def send_conversation_message(
    session: Session,
    actor: User,
    conversation_id: str,
    content: str,
    idempotency_key: str,
    request_id: str,
    agent: AgentPort,
) -> tuple[int, dict]:
    require_student(actor)
    return await _send_message(
        session,
        actor=actor,
        conversation_id=conversation_id,
        content=content,
        idempotency_key=idempotency_key,
        request_id=request_id,
        agent=agent,
        operation="conversation_message",
        resource_id=conversation_id,
    )


async def send_ticket_message(
    session: Session,
    actor: User,
    ticket_id: str,
    content: str,
    idempotency_key: str,
    request_id: str,
    agent: AgentPort,
) -> tuple[int, dict]:
    require_student(actor)
    ticket = session.get(Ticket, ticket_id)
    if ticket is None or ticket.student_id != actor.id:
        raise not_found()
    return await _send_message(
        session,
        actor=actor,
        conversation_id=ticket.conversation_id,
        content=content,
        idempotency_key=idempotency_key,
        request_id=request_id,
        agent=agent,
        operation="ticket_message",
        resource_id=ticket_id,
    )


async def _send_message(
    session: Session,
    *,
    actor: User,
    conversation_id: str,
    content: str,
    idempotency_key: str,
    request_id: str,
    agent: AgentPort,
    operation: str,
    resource_id: str,
) -> tuple[int, dict]:
    payload = {"content": content}
    handle = begin_idempotent(
        session, actor=actor, operation=operation, resource_id=resource_id, key=idempotency_key, payload=payload
    )
    if handle.outcome == "replay":
        session.commit()
        return handle.http_status or 200, handle.body or {}
    if handle.outcome == "processing":
        session.commit()
        return 202, processing_body(handle.record.id)

    conversation = lock_conversation(session, conversation_id)
    if conversation is None or conversation.owner_id != actor.id:
        raise not_found()
    if conversation.status == "closed":
        raise ApiError(409, "TICKET_CLOSED", "Yêu cầu đã đóng. Hãy mở cuộc trò chuyện mới.")
    busy = session.execute(
        select(IntakeOperation).where(
            IntakeOperation.conversation_id == conversation.id, IntakeOperation.state == "processing"
        )
    ).scalar_one_or_none()
    if busy is not None and busy.idempotency_key != idempotency_key:
        raise ApiError(
            409,
            "CONVERSATION_BUSY",
            "Hệ thống đang xử lý tin trước đó.",
            details=c.ErrorDetails(conversation_id=conversation.id),
        )

    now = utcnow()
    ticket = ticket_for_conversation(session, conversation.id)
    if ticket is not None and ticket.status == "resolved":
        raise ApiError(409, "TICKET_CLOSED", "Yêu cầu đã đóng. Hãy mở cuộc trò chuyện mới.")

    existing_op = session.execute(
        select(IntakeOperation).where(
            IntakeOperation.conversation_id == conversation.id,
            IntakeOperation.idempotency_key == idempotency_key,
            IntakeOperation.payload_hash == hash_payload(payload),
        )
    ).scalar_one_or_none()
    if existing_op is not None and existing_op.user_message_id:
        operation_row = existing_op
        user_message = session.get(Message, existing_op.user_message_id)
    else:
        user_message = _add_message(
            session,
            conversation,
            sender="student",
            content=content,
            actor_id=actor.id,
            ticket_id=ticket.id if ticket else None,
            now=now,
        )
        operation_row = IntakeOperation(
            id=new_id("iop"),
            conversation_id=conversation.id,
            actor_id=actor.id,
            request_id=request_id,
            idempotency_key=idempotency_key,
            state="processing",
            user_message_id=user_message.id,
            payload_hash=hash_payload(payload),
            created_at=now,
            updated_at=now,
        )
        session.add(operation_row)
        conversation.updated_at = now
        session.flush()
    session.commit()

    if conversation.ai_response_locked:
        return _handle_locked_followup(
            session, actor, conversation, ticket, user_message, operation_row, handle, request_id
        )

    try:
        context = _intake_context(session, actor, conversation, user_message, ticket, request_id)
        result = await agent.run_intake(context)
    except c.ModuleCallError as exc:
        _mark_operation(session, operation_row, "retryable_failed", exc.error.code)
        session.commit()
        raise ApiError(
            503,
            "AI_UNAVAILABLE",
            "Chưa tạo được phản hồi. Tin nhắn của bạn đã được lưu.",
            retryable=True,
            details=c.ErrorDetails(conversation_id=conversation.id, user_message_id=user_message.id),
        ) from exc

    if ticket is not None and result.route != "L4":
        return _supplement_without_l4(session, conversation, ticket, user_message, operation_row, handle, request_id)

    if result.route == "L4":
        return _complete_l4(
            session, actor, conversation, ticket, user_message, operation_row, result, handle, request_id
        )
    if result.route == "L2":
        return _complete_l2(session, conversation, user_message, operation_row, result, handle, request_id)
    return _complete_l1(session, conversation, user_message, operation_row, result, handle, request_id)


def patch_preview(
    session: Session, actor: User, preview_id: str, body: c.PreviewPatch, idempotency_key: str, request_id: str
) -> tuple[int, dict]:
    require_student(actor)
    handle = begin_idempotent(
        session,
        actor=actor,
        operation="patch_preview",
        resource_id=preview_id,
        key=idempotency_key,
        payload=body.model_dump(mode="json"),
    )
    if handle.outcome == "replay":
        session.commit()
        return handle.http_status or 200, handle.body or {}
    if handle.outcome == "processing":
        session.commit()
        return 202, processing_body(handle.record.id)
    preview = session.get(Preview, preview_id)
    if preview is None or preview.owner_id != actor.id:
        raise not_found()
    conversation = lock_conversation(session, preview.conversation_id)
    if conversation is None:
        raise not_found()
    if conversation.ai_response_locked:
        raise ApiError(
            409,
            "CONVERSATION_LOCKED",
            "Cuộc trò chuyện đã chuyển cán bộ.",
            details=c.ErrorDetails(conversation_id=conversation.id, ai_response_locked=True),
        )
    if _busy(session, conversation.id):
        raise ApiError(409, "CONVERSATION_BUSY", "Hệ thống đang xử lý tin trước đó.")
    if preview.status != "active":
        raise ApiError(409, "PREVIEW_EXPIRED", "Preview không còn hiệu lực.")
    if preview.version != body.expected_version:
        raise ApiError(
            409, "STALE_PREVIEW", "Preview đã thay đổi.", details=c.ErrorDetails(current_version=preview.version)
        )
    now = utcnow()
    if preview.expires_at <= now:
        preview.status = "invalidated"
        session.commit()
        raise ApiError(409, "PREVIEW_EXPIRED", "Preview đã hết hạn.")
    preview.purpose = body.fields.purpose
    preview.destination_org = body.fields.destination_org
    preview.receive_method = body.fields.receive_method
    preview.missing_fields = [key for key, value in body.fields.model_dump().items() if value is None]
    preview.invalid_fields = []
    preview.version += 1
    preview.expires_at = now + timedelta(seconds=get_settings().preview_ttl_seconds)
    preview.updated_at = now
    _store_preview_revision(session, preview, now)
    conversation.updated_at = now
    body_out = preview_to_contract(preview, now).model_dump(mode="json")
    complete_idempotent(session, handle.record, 200, body_out)
    session.commit()
    return 200, body_out


def submit1(session: Session, actor: User, body: c.Submit1, idempotency_key: str, request_id: str) -> tuple[int, dict]:
    require_student(actor)
    handle = begin_idempotent(
        session,
        actor=actor,
        operation="submit1",
        resource_id=body.preview_id,
        key=idempotency_key,
        payload=body.model_dump(mode="json"),
    )
    if handle.outcome == "replay":
        session.commit()
        return handle.http_status or 201, handle.body or {}
    if handle.outcome == "processing":
        session.commit()
        return 202, processing_body(handle.record.id)
    preview = session.get(Preview, body.preview_id)
    if preview is None or preview.owner_id != actor.id:
        raise not_found()
    conversation = lock_conversation(session, preview.conversation_id)
    if conversation is None or conversation.owner_id != actor.id:
        raise not_found()
    if conversation.ai_response_locked or conversation.handover_status != "none":
        raise ApiError(
            409,
            "CONVERSATION_LOCKED",
            "Cuộc trò chuyện đang được kiểm tra an toàn hoặc đã chuyển cán bộ.",
            details=c.ErrorDetails(
                conversation_id=conversation.id,
                ai_response_locked=conversation.ai_response_locked,
                handover_status=conversation.handover_status,
            ),  # type: ignore[arg-type]
        )
    if _busy(session, conversation.id):
        raise ApiError(409, "CONVERSATION_BUSY", "Không thể nộp khi hệ thống đang kiểm tra tin nhắn.")
    now = utcnow()
    if preview.status == "consumed" and preview.consumed_ticket_id:
        ticket = session.get(Ticket, preview.consumed_ticket_id)
        raise ApiError(
            409,
            "PREVIEW_ALREADY_SUBMITTED",
            "Yêu cầu này đã được nộp.",
            details=c.ErrorDetails(ticket_id=preview.consumed_ticket_id, conversation_id=conversation.id),
        )
    if preview.status != "active":
        raise ApiError(409, "PREVIEW_EXPIRED", "Preview không còn hiệu lực.")
    if preview.version != body.preview_version:
        raise ApiError(
            409, "STALE_PREVIEW", "Preview đã thay đổi.", details=c.ErrorDetails(current_version=preview.version)
        )
    if preview.expires_at <= now:
        preview.status = "invalidated"
        session.commit()
        raise ApiError(409, "PREVIEW_EXPIRED", "Preview đã hết hạn.")
    contract = preview_to_contract(preview, now)
    if not contract.can_submit:
        raise validation("Preview chưa đủ dữ liệu để nộp.")
    profile = session.get(StudentProfile, actor.id)
    if profile is None or not profile.mssv or not profile.full_name:
        raise validation("Hồ sơ demo thiếu tên hoặc MSSV.")
    if ticket_for_conversation(session, conversation.id) is not None:
        raise ApiError(409, "PREVIEW_ALREADY_SUBMITTED", "Cuộc trò chuyện đã có yêu cầu.")

    ticket = _create_ticket(
        session,
        conversation=conversation,
        student=actor,
        team_id=SERVICE_TEAM["student_certificate"],
        category="action",
        service_type="student_certificate",
        status="open",
        priority="normal",
        priority_reasons=[],
        summary=f"Xin giấy xác nhận sinh viên để {preview.purpose}",
        request_data=contract.fields.model_dump(mode="json"),
        handover_reason=None,
        now=now,
    )
    preview.status = "consumed"
    preview.consumed_ticket_id = ticket.id
    preview.updated_at = now
    session.add(
        IntakePacket(
            id=new_id("inp"),
            ticket_id=ticket.id,
            version=1,
            service_type="student_certificate",
            fields=contract.fields.model_dump(mode="json"),
            created_at=now,
        )
    )
    _link_messages(session, conversation.id, ticket.id)
    _audit(session, ticket, actor.id, "student", "create", None, "open", request_id, now)
    enqueue_prepare_brief(session, ticket)
    result = c.Submit1Result(ticket=ticket_to_contract(ticket), brief_status="pending")
    body_out = result.model_dump(mode="json")
    complete_idempotent(session, handle.record, 201, body_out)
    session.commit()
    return 201, body_out


def retry_handover(session: Session, job) -> None:
    conversation = lock_conversation(session, job.conversation_id)
    if conversation is None:
        job.state = "failed"
        session.commit()
        return
    decision = session.execute(
        select(SafetyDecision).where(SafetyDecision.operation_id == job.operation_id)
    ).scalar_one_or_none()
    operation = session.get(IntakeOperation, job.operation_id)
    if decision is None or operation is None:
        job.state = "failed"
        session.commit()
        return
    existing = ticket_for_conversation(session, conversation.id)
    if _handover_already_applied(session, existing, decision):
        conversation.handover_status = "completed"
        conversation.ai_response_locked = True
        conversation.status = "handover"
        job.state = "succeeded"
        session.commit()
        return
    try:
        _commit_handover_ticket(session, conversation, decision, utcnow())
        conversation.handover_status = "completed"
        conversation.ai_response_locked = True
        conversation.status = "handover"
        job.state = "succeeded"
        session.commit()
    except Exception:
        session.rollback()
        conversation = lock_conversation(session, job.conversation_id)
        job_row = session.get(type(job), job.id)
        if conversation is not None:
            conversation.handover_status = "failed"
        if job_row is not None:
            job_row.state = "pending"
            job_row.available_at = utcnow() + timedelta(seconds=8)
        session.commit()


def _complete_l1(session, conversation, user_message, operation, result, handle, request_id) -> tuple[int, dict]:
    now = utcnow()
    reply = _add_message(session, conversation, "assistant", result.reply or MSG_SUPPLEMENT, None, None, now)
    for citation in result.citations:
        session.add(
            MessageCitation(
                id=new_id("cit"),
                message_id=reply.id,
                document_id=citation.document_id,
                document_title=citation.document_title,
                document_version=citation.document_version,
                chunk_id=citation.chunk_id,
                locator=citation.locator,
                quote=citation.quote,
                url=citation.url,
            )
        )
    operation.state = "completed"
    operation.route = "L1"
    operation.outcome = result.outcome
    operation.updated_at = now
    chat = c.ChatResult(
        conversation_id=conversation.id,
        user_message_id=user_message.id,
        route="L1",
        outcome=result.outcome,  # type: ignore[arg-type]
        reply=message_to_contract(reply),
        citations=list(result.citations),
        preview=None,
        ticket=None,
        conversation_state=conversation_state(conversation),
    )
    body = chat.model_dump(mode="json")
    complete_idempotent(session, handle.record, 200, body)
    session.commit()
    return 200, body


def _complete_l2(session, conversation, user_message, operation, result, handle, request_id) -> tuple[int, dict]:
    now = utcnow()
    intake = result.intake
    assert intake is not None
    preview = _upsert_preview(session, conversation, user_message.sender_user_id, intake, now)
    reply = _add_message(session, conversation, "assistant", result.reply or "", None, None, now)
    operation.state = "completed"
    operation.route = "L2"
    operation.outcome = result.outcome
    operation.updated_at = now
    chat = c.ChatResult(
        conversation_id=conversation.id,
        user_message_id=user_message.id,
        route="L2",
        outcome=result.outcome,  # type: ignore[arg-type]
        reply=message_to_contract(reply),
        citations=[],
        preview=preview_to_contract(preview, now),
        ticket=None,
        conversation_state=conversation_state(conversation),
    )
    body = chat.model_dump(mode="json")
    complete_idempotent(session, handle.record, 200, body)
    session.commit()
    return 200, body


def _complete_l4(
    session, actor, conversation, ticket, user_message, operation, result, handle, request_id
) -> tuple[int, dict]:
    now = utcnow()
    handover = result.handover
    assert handover is not None
    try:
        decision = SafetyDecision(
            id=new_id("saf"),
            conversation_id=conversation.id,
            operation_id=operation.id,
            message_id=user_message.id,
            risk_type=handover.risk_type,
            reason=handover.reason,
            summary=handover.summary,
            source_message_ids=list(handover.source_message_ids),
            created_at=now,
        )
        session.add(decision)
        conversation.ai_response_locked = True
        conversation.handover_status = "pending"
        conversation.status = "handover"
        conversation.revision += 1
        conversation.updated_at = now
        _invalidate_previews(session, conversation.id, now)
        session.flush()
        session.commit()
    except Exception as exc:  # noqa: BLE001
        session.rollback()
        raise persistence_unavailable() from exc

    conversation = lock_conversation(session, conversation.id)
    try:
        ticket = _commit_handover_ticket(session, conversation, decision, now)
        conversation.handover_status = "completed"
        _link_messages(session, conversation.id, ticket.id)
        reply = _add_message(session, conversation, "system", MSG_HANDOVER, None, ticket.id, utcnow())
        operation.state = "completed"
        operation.route = "L4"
        operation.outcome = "handover_completed"
        operation.updated_at = utcnow()
        enqueue_prepare_brief(session, ticket)
        chat = c.ChatResult(
            conversation_id=conversation.id,
            user_message_id=user_message.id,
            route="L4",
            outcome="handover_completed",
            reply=message_to_contract(reply),
            citations=[],
            preview=None,
            ticket=ticket_ref(ticket),
            conversation_state=conversation_state(conversation),
        )
        body = chat.model_dump(mode="json")
        complete_idempotent(session, handle.record, 200, body)
        session.commit()
        return 200, body
    except Exception:
        conversation_id = conversation.id
        user_message_id = user_message.id
        operation_id = operation.id
        session.rollback()
        conversation = lock_conversation(session, conversation_id)
        operation = session.get(IntakeOperation, operation_id)
        if conversation is not None:
            conversation.handover_status = "failed"
            conversation.ai_response_locked = True
            conversation.status = "handover"
            enqueue_retry_handover(session, conversation.id, operation_id)
        if operation is not None:
            operation.state = "retryable_failed"
            operation.updated_at = utcnow()
        session.commit()
        raise ApiError(
            503,
            "HANDOVER_FAILED",
            "Chưa chuyển được yêu cầu tới cán bộ. Hệ thống đã dừng trả lời tự động; bạn có thể thử lại.",
            retryable=True,
            details=c.ErrorDetails(
                conversation_id=conversation_id,
                user_message_id=user_message_id,
                ticket_id=None,
                ai_response_locked=True,
                handover_status="failed",
            ),
        )


def _handle_locked_followup(session, actor, conversation, ticket, user_message, operation, handle, request_id):
    now = utcnow()
    if ticket is None:
        operation.state = "completed"
        operation.outcome = "handover_pending"
        operation.updated_at = now
        session.commit()
        raise ApiError(
            503,
            "HANDOVER_FAILED",
            "Hệ thống đã dừng trả lời tự động nhưng chưa chuyển được tới cán bộ.",
            retryable=True,
            details=c.ErrorDetails(
                conversation_id=conversation.id,
                user_message_id=user_message.id,
                ai_response_locked=True,
                handover_status=conversation.handover_status,  # type: ignore[arg-type]
            ),
        )
    user_message.ticket_id = ticket.id
    ticket.revision += 1
    ticket.updated_at = now
    mark_briefs_stale(session, ticket.id)
    enqueue_prepare_brief(session, ticket)
    reply = _add_message(session, conversation, "system", MSG_FORWARDED, None, ticket.id, now)
    _audit(session, ticket, actor.id, "student", "supplement", ticket.status, ticket.status, request_id, now)
    operation.state = "completed"
    operation.route = "L4"
    operation.outcome = "forwarded_to_officer"
    operation.updated_at = now
    conversation.updated_at = now
    chat = c.ChatResult(
        conversation_id=conversation.id,
        user_message_id=user_message.id,
        route="L4",
        outcome="forwarded_to_officer",
        reply=message_to_contract(reply),
        citations=[],
        preview=None,
        ticket=ticket_ref(ticket),
        conversation_state=conversation_state(conversation),
    )
    body = chat.model_dump(mode="json")
    complete_idempotent(session, handle.record, 200, body)
    session.commit()
    return 200, body


def _supplement_without_l4(session, conversation, ticket, user_message, operation, handle, request_id):
    now = utcnow()
    user_message.ticket_id = ticket.id
    ticket.revision += 1
    ticket.updated_at = now
    mark_briefs_stale(session, ticket.id)
    enqueue_prepare_brief(session, ticket)
    reply = _add_message(session, conversation, "system", MSG_SUPPLEMENT, None, ticket.id, now)
    _audit(
        session, ticket, conversation.owner_id, "student", "supplement", ticket.status, ticket.status, request_id, now
    )
    operation.state = "completed"
    operation.route = "L2"
    operation.outcome = "supplement_received"
    operation.updated_at = now
    chat = c.ChatResult(
        conversation_id=conversation.id,
        user_message_id=user_message.id,
        route="L2",
        outcome="supplement_received",
        reply=message_to_contract(reply),
        citations=[],
        preview=None,
        ticket=ticket_ref(ticket),
        conversation_state=conversation_state(conversation),
    )
    body = chat.model_dump(mode="json")
    complete_idempotent(session, handle.record, 200, body)
    session.commit()
    return 200, body


def _handover_already_applied(session, ticket: Ticket | None, decision: SafetyDecision) -> bool:
    if ticket is None:
        return False
    category, service_type, team_id, _scope = RISK_ROUTING[decision.risk_type]
    if (
        ticket.status != "pending_officer"
        or ticket.priority != "high"
        or ticket.category != category
        or ticket.service_type != service_type
        or ticket.team_id != team_id
        or not ticket.handover_reason
    ):
        return False
    packet = session.execute(select(HandoverPacket).where(HandoverPacket.ticket_id == ticket.id)).scalars().first()
    return packet is not None


def _commit_handover_ticket(session, conversation, decision: SafetyDecision, now) -> Ticket:
    category, service_type, team_id, _scope = RISK_ROUTING[decision.risk_type]
    team = session.get(Team, team_id)
    if team is None:
        raise ApiError(503, "HANDOVER_FAILED", "Chưa có nhóm cán bộ phù hợp để nhận ca.", retryable=True)
    existing = ticket_for_conversation(session, conversation.id)
    if existing is not None:
        from_status = existing.status
        existing.category = category
        existing.service_type = service_type
        existing.team_id = team_id
        existing.status = "pending_officer"
        existing.priority = "high"
        existing.priority_reasons = [decision.reason]
        existing.handover_reason = decision.reason
        existing.revision += 1
        existing.updated_at = now
        session.add(
            HandoverPacket(
                id=new_id("hop"),
                ticket_id=existing.id,
                risk_type=decision.risk_type,
                reason=decision.reason,
                summary=decision.summary,
                source_message_ids=list(decision.source_message_ids),
                created_at=now,
            )
        )
        _audit(
            session, existing, None, "system", "handover", from_status, "pending_officer", decision.operation_id, now
        )
        mark_briefs_stale(session, existing.id)
        enqueue_prepare_brief(session, existing)
        return existing
    ticket = _create_ticket(
        session,
        conversation=conversation,
        student=session.get(User, conversation.owner_id),
        team_id=team_id,
        category=category,
        service_type=service_type,
        status="pending_officer",
        priority="high",
        priority_reasons=[decision.reason],
        summary=decision.summary,
        request_data=None,
        handover_reason=decision.reason,
        now=now,
    )
    session.add(
        HandoverPacket(
            id=new_id("hop"),
            ticket_id=ticket.id,
            risk_type=decision.risk_type,
            reason=decision.reason,
            summary=decision.summary,
            source_message_ids=list(decision.source_message_ids),
            created_at=now,
        )
    )
    _audit(session, ticket, None, "system", "handover", None, "pending_officer", decision.operation_id, now)
    return ticket


def _create_ticket(
    session,
    *,
    conversation,
    student,
    team_id,
    category,
    service_type,
    status,
    priority,
    priority_reasons,
    summary,
    request_data,
    handover_reason,
    now,
) -> Ticket:
    year = now.year
    ticket = Ticket(
        id=new_id("tkt"),
        code=next_ticket_code(session, year),
        conversation_id=conversation.id,
        student_id=student.id,
        team_id=team_id,
        assigned_officer_id=None,
        category=category,
        service_type=service_type,
        status=status,
        priority=priority,
        priority_reasons=priority_reasons,
        summary=summary,
        request_data=request_data,
        handover_reason=handover_reason,
        revision=1,
        created_at=now,
        updated_at=now,
    )
    session.add(ticket)
    session.flush()
    return ticket


def _upsert_preview(session, conversation, owner_id, intake: c.Intake, now) -> Preview:
    preview = session.execute(
        select(Preview).where(Preview.conversation_id == conversation.id, Preview.status == "active")
    ).scalar_one_or_none()
    ttl = timedelta(seconds=get_settings().preview_ttl_seconds)
    fields = intake.fields
    if preview is None:
        preview = Preview(
            id=new_id("prv"),
            conversation_id=conversation.id,
            owner_id=owner_id,
            service_type=intake.service_type,
            purpose=fields.purpose,
            destination_org=fields.destination_org,
            receive_method=fields.receive_method,
            version=1,
            expires_at=now + ttl,
            status="active",
            missing_fields=list(intake.missing_fields),
            invalid_fields=[item.model_dump(mode="json") for item in intake.invalid_fields],
            created_at=now,
            updated_at=now,
        )
        session.add(preview)
        session.flush()
    else:
        preview.purpose = fields.purpose
        preview.destination_org = fields.destination_org
        preview.receive_method = fields.receive_method
        preview.missing_fields = list(intake.missing_fields)
        preview.invalid_fields = [item.model_dump(mode="json") for item in intake.invalid_fields]
        preview.version += 1
        preview.expires_at = now + ttl
        preview.updated_at = now
    _store_preview_revision(session, preview, now)
    return preview


def _store_preview_revision(session, preview: Preview, now) -> None:
    session.add(
        PreviewRevision(
            id=new_id("prvrev"),
            preview_id=preview.id,
            version=preview.version,
            purpose=preview.purpose,
            destination_org=preview.destination_org,
            receive_method=preview.receive_method,
            missing_fields=list(preview.missing_fields or []),
            invalid_fields=list(preview.invalid_fields or []),
            created_at=now,
        )
    )


def _invalidate_previews(session, conversation_id: str, now) -> None:
    for preview in session.execute(
        select(Preview).where(Preview.conversation_id == conversation_id, Preview.status == "active")
    ).scalars():
        preview.status = "invalidated"
        preview.updated_at = now


def _add_message(session, conversation, sender, content, actor_id, ticket_id, now) -> Message:
    message = Message(
        id=new_id("msg"),
        conversation_id=conversation.id,
        ticket_id=ticket_id,
        sender=sender,
        sender_user_id=actor_id,
        content=content,
        seq=next_message_seq(session, conversation.id),
        created_at=now,
    )
    session.add(message)
    conversation.updated_at = now
    session.flush()
    return message


def _link_messages(session, conversation_id: str, ticket_id: str) -> None:
    for message in session.execute(
        select(Message).where(Message.conversation_id == conversation_id, Message.ticket_id.is_(None))
    ).scalars():
        message.ticket_id = ticket_id


def _audit(session, ticket, actor_id, actor_type, action, from_status, to_status, request_id, now) -> AuditEntry:
    entry = AuditEntry(
        id=new_id("aud"),
        ticket_id=ticket.id,
        actor_id=actor_id,
        actor_type=actor_type,
        action=action,
        from_status=from_status,
        to_status=to_status,
        request_id=request_id,
        created_at=now,
    )
    session.add(entry)
    return entry


def _busy(session, conversation_id: str) -> bool:
    return (
        session.execute(
            select(IntakeOperation.id).where(
                IntakeOperation.conversation_id == conversation_id, IntakeOperation.state == "processing"
            )
        ).scalar_one_or_none()
        is not None
    )


def _mark_operation(session, operation, state, error) -> None:
    operation.state = state
    operation.last_error = error
    operation.updated_at = utcnow()


def _intake_context(session, actor, conversation, user_message, ticket, request_id) -> c.IntakeContext:
    profile = session.get(StudentProfile, actor.id)
    if profile is None:
        raise validation("Thiếu hồ sơ sinh viên demo.")
    history_rows = (
        session.execute(
            select(Message)
            .where(Message.conversation_id == conversation.id, Message.id != user_message.id)
            .order_by(Message.created_at.desc(), Message.id.desc())
            .limit(20)
        )
        .scalars()
        .all()
    )
    history = [message_to_contract(row) for row in reversed(list(history_rows))]
    preview_row = session.execute(
        select(Preview).where(Preview.conversation_id == conversation.id, Preview.status == "active")
    ).scalar_one_or_none()
    return c.IntakeContext(
        request_id=request_id,
        conversation_id=conversation.id,
        conversation_revision=conversation.revision,
        actor=c.Actor(user_id=actor.id, role="student"),
        student_profile=profile_to_contract(profile),
        message=message_to_contract(user_message),
        history=history,
        preview=preview_to_contract(preview_row) if preview_row else None,
        linked_ticket=ticket_to_contract(ticket) if ticket else None,
        policy_scope="demo_academic",
        effective_at=utcnow(),
    )
