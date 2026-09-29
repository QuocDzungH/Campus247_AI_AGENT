from datetime import timedelta

import pytest

from src.agents.stubs import StubAgent
from src.db.models import (
    AuditEntry,
    Conversation,
    HandoverPacket,
    IntakeOperation,
    Job,
    Preview,
    SafetyDecision,
    Ticket,
)
from src.models.contracts_v1 import (
    ClaimRequest,
    Fields,
    Handover,
    Intake,
    IntakeResult,
    Submit1,
    Submit2,
)
from src.services.errors import ApiError
from src.services.runtime import set_agent
from src.services.staff import claim_ticket, submit2
from src.services.student import create_conversation, send_conversation_message, submit1


def _user(session, user_id):
    from src.db.models import User

    return session.get(User, user_id)


async def _new_conversation(session, student):
    _, body = create_conversation(session, student, f"conv-{student.id}-1", "req-conv")
    return body["id"]


PREVIEW_INTAKE = IntakeResult(
    route="L2",
    outcome="preview_ready",
    reply="Bạn hãy kiểm tra thông tin trước khi gửi.",
    citations=[],
    intake=Intake(
        service_type="student_certificate",
        fields=Fields(purpose="Vay vốn ngân hàng", destination_org="Ngân hàng mẫu A", receive_method="paper_stamped"),
        missing_fields=[],
        invalid_fields=[],
    ),
    handover=None,
)


@pytest.mark.asyncio
async def test_submit1_guards_and_idempotency(db_url, db_session, restore_agent):
    set_agent(StubAgent(intake_result=PREVIEW_INTAKE))
    student = _user(db_session, "SV-DEMO-001")
    conversation_id = await _new_conversation(db_session, student)
    status, chat = await send_conversation_message(
        db_session,
        student,
        conversation_id,
        "Xin giấy xác nhận",
        "msg-1",
        "req-msg",
        StubAgent(intake_result=PREVIEW_INTAKE),
    )
    assert status == 200
    preview = chat["preview"]
    with pytest.raises(ApiError) as stale:
        submit1(
            db_session,
            student,
            Submit1(preview_id=preview["id"], preview_version=preview["version"] + 5, confirmed=True),
            "sub-stale-version",
            "req-sub-stale",
        )
    assert stale.value.code == "STALE_PREVIEW"

    expired = db_session.get(Preview, preview["id"])
    expired.expires_at = expired.expires_at - timedelta(hours=2)
    db_session.commit()
    with pytest.raises(ApiError) as expired_error:
        submit1(
            db_session,
            student,
            Submit1(preview_id=preview["id"], preview_version=preview["version"], confirmed=True),
            "sub-expired",
            "req-exp",
        )
    assert expired_error.value.code == "PREVIEW_EXPIRED"

    expired.status = "active"
    expired.expires_at = expired.expires_at + timedelta(hours=3)
    db_session.commit()
    status, first = submit1(
        db_session,
        student,
        Submit1(preview_id=preview["id"], preview_version=preview["version"], confirmed=True),
        "sub-ok",
        "req-ok",
    )
    assert status == 201
    ticket_id = first["ticket"]["id"]
    replay_status, replay = submit1(
        db_session,
        student,
        Submit1(preview_id=preview["id"], preview_version=preview["version"], confirmed=True),
        "sub-ok",
        "req-ok-2",
    )
    assert replay_status == 201
    assert replay["ticket"]["id"] == ticket_id
    with pytest.raises(ApiError) as payload_conflict:
        submit1(
            db_session,
            student,
            Submit1(preview_id=preview["id"], preview_version=9, confirmed=True),
            "sub-ok",
            "req-diff",
        )
    assert payload_conflict.value.code == "IDEMPOTENCY_CONFLICT"
    with pytest.raises(ApiError) as consumed:
        submit1(
            db_session,
            student,
            Submit1(preview_id=preview["id"], preview_version=preview["version"], confirmed=True),
            "sub-new-key",
            "req-new",
        )
    assert consumed.value.code == "PREVIEW_ALREADY_SUBMITTED"
    from sqlalchemy import select as sql_select

    audits = (
        db_session.execute(
            sql_select(AuditEntry).where(AuditEntry.ticket_id == ticket_id, AuditEntry.action == "create")
        )
        .scalars()
        .all()
    )
    assert len(audits) == 1


@pytest.mark.asyncio
async def test_l4_does_not_return_code_before_commit_and_blocks_l2(db_session, restore_agent):
    student = _user(db_session, "SV-DEMO-002")
    conversation_id = await _new_conversation(db_session, student)
    l4 = IntakeResult(
        route="L4",
        outcome="handover_required",
        reply=None,
        citations=[],
        intake=None,
        handover=Handover(
            risk_type="academic_complaint",
            reason="Sinh viên gửi khiếu nại điểm",
            summary="Cần cán bộ kiểm tra điểm",
            source_message_ids=["will-replace"],
        ),
    )

    class CapturingAgent(StubAgent):
        async def run_intake(self, context):
            payload = l4.model_copy(deep=True)
            payload.handover.source_message_ids = [context.message.id]
            return payload

    status, body = await send_conversation_message(
        db_session, student, conversation_id, "Tôi muốn gửi khiếu nại điểm", "l4-1", "req-l4", CapturingAgent()
    )
    assert status == 200
    assert body["outcome"] == "handover_completed"
    assert body["ticket"]["status"] == "pending_officer"
    assert body["ticket"]["priority"] == "high"
    conversation = db_session.get(Conversation, conversation_id)
    assert conversation.ai_response_locked is True
    status2, body2 = await send_conversation_message(
        db_session,
        student,
        conversation_id,
        "Bổ sung thêm thông tin",
        "l2-after-l4",
        "req-l2",
        StubAgent(intake_result=PREVIEW_INTAKE),
    )
    assert status2 == 200
    assert body2["outcome"] == "forwarded_to_officer"
    from sqlalchemy import select as sql_select

    tickets = db_session.execute(sql_select(Ticket).where(Ticket.conversation_id == conversation_id)).scalars().all()
    assert len(tickets) == 1


@pytest.mark.asyncio
async def test_l4_retry_does_not_duplicate_ticket(db_session, restore_agent):
    student = _user(db_session, "SV-DEMO-003")
    conversation_id = await _new_conversation(db_session, student)

    class OnceFailingHandover(StubAgent):
        async def run_intake(self, context):
            return IntakeResult(
                route="L4",
                outcome="handover_required",
                reply=None,
                citations=[],
                intake=None,
                handover=Handover(
                    risk_type="wellbeing",
                    reason="Cần hỗ trợ sinh viên",
                    summary="Chuyển cán bộ hỗ trợ",
                    source_message_ids=[context.message.id],
                ),
            )

    status, body = await send_conversation_message(
        db_session, student, conversation_id, "Em đang rất căng thẳng", "l4-w", "req-w", OnceFailingHandover()
    )
    assert status == 200
    ticket_id = body["ticket"]["id"]
    status2, body2 = await send_conversation_message(
        db_session, student, conversation_id, "Em đang rất căng thẳng", "l4-w", "req-w2", OnceFailingHandover()
    )
    assert body2["ticket"]["id"] == ticket_id
    from sqlalchemy import func
    from sqlalchemy import select as sql_select

    assert (
        db_session.execute(
            sql_select(func.count()).select_from(Ticket).where(Ticket.conversation_id == conversation_id)
        ).scalar_one()
        == 1
    )
    support = db_session.get(Ticket, ticket_id)
    assert support.team_id == "student_support"


@pytest.mark.asyncio
async def test_retry_handover_upgrades_existing_open_ticket(db_session, restore_agent):
    from sqlalchemy import select as sql_select

    from src.services.common import new_id, utcnow
    from src.services.student import retry_handover

    set_agent(StubAgent(intake_result=PREVIEW_INTAKE))
    student = _user(db_session, "SV-DEMO-007")
    conversation_id = await _new_conversation(db_session, student)
    _, chat = await send_conversation_message(
        db_session,
        student,
        conversation_id,
        "Xin giấy xác nhận",
        "l4-retry-msg",
        "req-l4-retry",
        StubAgent(intake_result=PREVIEW_INTAKE),
    )
    _, submitted = submit1(
        db_session,
        student,
        Submit1(preview_id=chat["preview"]["id"], preview_version=chat["preview"]["version"], confirmed=True),
        "l4-retry-sub",
        "req-l4-retry-sub",
    )
    ticket_id = submitted["ticket"]["id"]
    ticket = db_session.get(Ticket, ticket_id)
    assert ticket.status == "open"
    assert ticket.priority == "normal"
    assert ticket.service_type == "student_certificate"
    now = utcnow()
    conversation = db_session.get(Conversation, conversation_id)
    conversation.ai_response_locked = True
    conversation.handover_status = "failed"
    conversation.status = "handover"
    operation = IntakeOperation(
        id=new_id("iop"),
        conversation_id=conversation_id,
        actor_id=student.id,
        request_id="req-l4-retry-op",
        state="retryable_failed",
        created_at=now,
        updated_at=now,
    )
    db_session.add(operation)
    db_session.flush()
    from src.db.models import Message

    message = (
        db_session.execute(
            sql_select(Message).where(Message.conversation_id == conversation_id).order_by(Message.created_at.desc())
        )
        .scalars()
        .first()
    )
    decision = SafetyDecision(
        id=new_id("saf"),
        conversation_id=conversation_id,
        operation_id=operation.id,
        message_id=message.id,
        risk_type="academic_complaint",
        reason="Khiếu nại sau khi đã có ticket giấy",
        summary="Nâng ticket L2 thành handover",
        source_message_ids=[message.id],
        created_at=now,
    )
    db_session.add(decision)
    job = Job(
        id=new_id("job"),
        kind="retry_handover",
        conversation_id=conversation_id,
        operation_id=operation.id,
        state="leased",
        attempts=1,
        available_at=now,
        created_at=now,
        updated_at=now,
    )
    db_session.add(job)
    db_session.commit()
    retry_handover(db_session, job)
    db_session.expire_all()
    ticket = db_session.get(Ticket, ticket_id)
    job = db_session.get(Job, job.id)
    conversation = db_session.get(Conversation, conversation_id)
    packet = (
        db_session.execute(sql_select(HandoverPacket).where(HandoverPacket.ticket_id == ticket_id)).scalars().first()
    )
    assert job.state == "succeeded"
    assert conversation.handover_status == "completed"
    assert ticket.status == "pending_officer"
    assert ticket.priority == "high"
    assert ticket.service_type == "academic_complaint"
    assert ticket.category == "complaint"
    assert ticket.handover_reason
    assert packet is not None


@pytest.mark.asyncio
async def test_l4_commit_failure_rolls_back_then_persists_retry(db_session, restore_agent, monkeypatch):
    from sqlalchemy import select as sql_select
    from sqlalchemy import text

    import src.services.student as student_mod

    def explode(session, _conversation, _decision, _now):
        session.execute(
            text(
                "INSERT INTO users (id, role, name, is_demo, created_at, updated_at) "
                "VALUES ('SV-DEMO-001','student','dup',1,'2026-01-01 00:00:00+00','2026-01-01 00:00:00+00')"
            )
        )
        session.flush()

    monkeypatch.setattr(student_mod, "_commit_handover_ticket", explode)
    student = _user(db_session, "SV-DEMO-008")
    conversation_id = await _new_conversation(db_session, student)
    l4 = IntakeResult(
        route="L4",
        outcome="handover_required",
        reply=None,
        citations=[],
        intake=None,
        handover=Handover(
            risk_type="academic_complaint",
            reason="Khiếu nại điểm",
            summary="Cần cán bộ học vụ",
            source_message_ids=["will-replace"],
        ),
    )

    class CapturingAgent(StubAgent):
        async def run_intake(self, context):
            payload = l4.model_copy(deep=True)
            payload.handover.source_message_ids = [context.message.id]
            return payload

    with pytest.raises(ApiError) as exc:
        await send_conversation_message(
            db_session, student, conversation_id, "Tôi khiếu nại điểm", "l4-fail", "req-l4-fail", CapturingAgent()
        )
    assert exc.value.status_code == 503
    assert exc.value.code == "HANDOVER_FAILED"
    db_session.expire_all()
    conversation = db_session.get(Conversation, conversation_id)
    assert conversation.ai_response_locked is True
    assert conversation.handover_status == "failed"
    jobs = (
        db_session.execute(sql_select(Job).where(Job.kind == "retry_handover", Job.conversation_id == conversation_id))
        .scalars()
        .all()
    )
    assert len(jobs) == 1
    assert jobs[0].state == "pending"
    operation = (
        db_session.execute(
            sql_select(IntakeOperation)
            .where(IntakeOperation.conversation_id == conversation_id)
            .order_by(IntakeOperation.created_at.desc())
        )
        .scalars()
        .first()
    )
    assert operation.state == "retryable_failed"
    tickets = db_session.execute(sql_select(Ticket).where(Ticket.conversation_id == conversation_id)).scalars().all()
    assert tickets == []


@pytest.mark.asyncio
async def test_submit2_revision_and_resolved_guard(db_session, restore_agent):
    set_agent(StubAgent(intake_result=PREVIEW_INTAKE))
    student = _user(db_session, "SV-DEMO-004")
    officer = _user(db_session, "OF-DEMO-01")
    conversation_id = await _new_conversation(db_session, student)
    _, chat = await send_conversation_message(
        db_session, student, conversation_id, "Xin giấy", "m-s2", "r-s2", StubAgent(intake_result=PREVIEW_INTAKE)
    )
    _, submitted = submit1(
        db_session,
        student,
        Submit1(preview_id=chat["preview"]["id"], preview_version=chat["preview"]["version"], confirmed=True),
        "s2-sub",
        "r-sub",
    )
    ticket_id = submitted["ticket"]["id"]
    revision = submitted["ticket"]["revision"]
    claim_ticket(
        db_session,
        officer,
        ticket_id,
        ClaimRequest(expected_revision=revision, confirmed=True),
        "s2-claim",
        "r-claim",
    )
    db_session.expire_all()
    ticket = db_session.get(Ticket, ticket_id)
    with pytest.raises(ApiError) as stale:
        submit2(
            db_session,
            officer,
            ticket_id,
            Submit2(action="respond", content="ok", expected_revision=1, reviewed_brief_version=99, confirmed=True),
            "s2-stale",
            "r-stale",
        )
    assert stale.value.code in {"STALE_REVISION", "STALE_BRIEF"}
    status, responded = submit2(
        db_session,
        officer,
        ticket_id,
        Submit2(
            action="respond",
            content="Phòng học vụ đã tiếp nhận hồ sơ.",
            expected_revision=ticket.revision,
            reviewed_brief_version=None,
            confirmed=True,
        ),
        "s2-ok",
        "r-ok",
    )
    assert status == 200
    assert responded["ticket"]["status"] == "pending_officer"
    ticket = db_session.get(Ticket, ticket_id)
    status, resolved = submit2(
        db_session,
        officer,
        ticket_id,
        Submit2(
            action="resolve",
            content="Đã hoàn tất yêu cầu.",
            expected_revision=ticket.revision,
            reviewed_brief_version=None,
            confirmed=True,
        ),
        "s2-res",
        "r-res",
    )
    assert resolved["ticket"]["status"] == "resolved"
    ticket = db_session.get(Ticket, ticket_id)
    with pytest.raises(ApiError) as closed:
        submit2(
            db_session,
            officer,
            ticket_id,
            Submit2(
                action="respond",
                content="ghi thêm",
                expected_revision=ticket.revision,
                reviewed_brief_version=None,
                confirmed=True,
            ),
            "s2-closed",
            "r-closed",
        )
    assert closed.value.code == "TICKET_CLOSED"


def test_transaction_rollback_does_not_leave_orphan_ticket(db_session):
    from src.db.models import Conversation
    from src.services.common import new_id, utcnow
    from src.services.student import _audit, _create_ticket

    student = _user(db_session, "SV-DEMO-005")
    now = utcnow()
    conversation = Conversation(
        id=new_id("conv"),
        owner_id=student.id,
        status="active",
        ai_response_locked=False,
        handover_status="none",
        revision=1,
        created_at=now,
        updated_at=now,
    )
    db_session.add(conversation)
    db_session.flush()
    ticket = _create_ticket(
        db_session,
        conversation=conversation,
        student=student,
        team_id="academic",
        category="action",
        service_type="student_certificate",
        status="open",
        priority="normal",
        priority_reasons=[],
        summary="rollback",
        request_data=None,
        handover_reason=None,
        now=now,
    )
    _audit(db_session, ticket, student.id, "student", "create", None, "open", "req-roll", now)
    ticket_id = ticket.id
    db_session.flush()
    db_session.rollback()
    assert db_session.get(Ticket, ticket_id) is None
    assert db_session.get(Conversation, conversation.id) is None
    from sqlalchemy import func
    from sqlalchemy import select as sql_select

    assert (
        db_session.execute(
            sql_select(func.count()).select_from(AuditEntry).where(AuditEntry.ticket_id == ticket_id)
        ).scalar_one()
        == 0
    )
