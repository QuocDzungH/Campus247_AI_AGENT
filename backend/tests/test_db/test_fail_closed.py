import pytest
from sqlalchemy import select

from campus247.agents.errors import module_error
from campus247.agents.stubs import StubAgent
from campus247.db.models import IdempotencyRecord, IntakeOperation, Message
from campus247.models.contracts_v1 import IntakeContext, IntakeResult, OfficerBrief, TicketSnapshot
from campus247.services.errors import ApiError
from campus247.services.student import create_conversation, send_conversation_message


def _user(session, user_id):
    from campus247.db.models import User

    return session.get(User, user_id)


class _RaisingAgent:
    def __init__(self, code: str, stage: str = "generation"):
        self.code = code
        self.stage = stage

    def brief_artifact_metadata(self):
        return {
            "model_name": "fail-closed-test",
            "prompt_version": "1",
            "template_version": "1",
            "index_version": None,
        }

    async def run_intake(self, context: IntakeContext) -> IntakeResult:
        raise module_error(self.code, stage=self.stage, request_id=context.request_id)

    async def prepare_officer_brief(self, snapshot: TicketSnapshot) -> OfficerBrief:
        raise module_error(self.code, stage="brief", request_id=snapshot.request_id)


async def _start_conversation(session, student, suffix: str):
    _, body = create_conversation(session, student, f"fc-conv-{suffix}", f"req-fc-{suffix}")
    return body["id"]


@pytest.mark.asyncio
async def test_provider_timeout_keeps_message_and_ai_unavailable(db_session, restore_agent):
    student = _user(db_session, "SV-DEMO-001")
    conversation_id = await _start_conversation(db_session, student, "timeout")
    with pytest.raises(ApiError) as exc:
        await send_conversation_message(
            db_session,
            student,
            conversation_id,
            "Quy trình cấp giấy xác nhận sinh viên như thế nào?",
            "fc-timeout",
            "req-fc-timeout",
            _RaisingAgent("PROVIDER_TIMEOUT", stage="generation"),
        )
    error = exc.value
    assert error.status_code == 503
    assert error.code == "AI_UNAVAILABLE"
    assert error.retryable is True
    assert "PROVIDER_TIMEOUT" in error.message
    assert error.details.user_message_id
    rows = db_session.execute(select(Message).where(Message.conversation_id == conversation_id)).scalars().all()
    assert len(rows) == 1
    assert rows[0].sender == "student"
    assert all(row.sender != "assistant" for row in rows)
    operation = db_session.execute(
        select(IntakeOperation).where(IntakeOperation.conversation_id == conversation_id)
    ).scalar_one()
    assert operation.state == "retryable_failed"
    assert operation.last_error == "PROVIDER_TIMEOUT"


@pytest.mark.asyncio
async def test_schema_error_is_ai_output_invalid_not_fake_success(db_session, restore_agent):
    student = _user(db_session, "SV-DEMO-001")
    conversation_id = await _start_conversation(db_session, student, "schema")
    with pytest.raises(ApiError) as exc:
        await send_conversation_message(
            db_session,
            student,
            conversation_id,
            "Quy trình cấp giấy xác nhận sinh viên như thế nào?",
            "fc-schema",
            "req-fc-schema",
            _RaisingAgent("OUTPUT_SCHEMA_INVALID", stage="intake"),
        )
    error = exc.value
    assert error.status_code == 422
    assert error.code == "AI_OUTPUT_INVALID"
    assert error.retryable is False
    assert "OUTPUT_SCHEMA_INVALID" in error.message
    rows = db_session.execute(select(Message).where(Message.conversation_id == conversation_id)).scalars().all()
    assert len(rows) == 1
    assert rows[0].sender == "student"
    operation = db_session.execute(
        select(IntakeOperation).where(IntakeOperation.conversation_id == conversation_id)
    ).scalar_one()
    assert operation.state == "terminal_failed"
    assert operation.last_error == "OUTPUT_SCHEMA_INVALID"


def _idempotency(session, key: str) -> IdempotencyRecord:
    return session.execute(select(IdempotencyRecord).where(IdempotencyRecord.key == key)).scalar_one()


@pytest.mark.asyncio
async def test_retryable_ai_error_replays_same_key_and_does_not_duplicate_message(db_session, restore_agent):
    student = _user(db_session, "SV-DEMO-001")
    conversation_id = await _start_conversation(db_session, student, "retry")

    class TimeoutThenOk(_RaisingAgent):
        def __init__(self):
            super().__init__("PROVIDER_TIMEOUT", stage="generation")
            self.calls = 0

        async def run_intake(self, context):
            self.calls += 1
            if self.calls == 1:
                return await super().run_intake(context)
            return await StubAgent().run_intake(context)

    agent = TimeoutThenOk()
    with pytest.raises(ApiError) as first:
        await send_conversation_message(
            db_session,
            student,
            conversation_id,
            "Quy trình cấp giấy xác nhận sinh viên như thế nào?",
            "fc-retry-key",
            "req-fc-retry-1",
            agent,
        )
    assert first.value.status_code == 503
    assert first.value.retryable is True
    record = _idempotency(db_session, "fc-retry-key")
    assert record.status == "processing"
    assert record.http_status is None
    status, body = await send_conversation_message(
        db_session,
        student,
        conversation_id,
        "Quy trình cấp giấy xác nhận sinh viên như thế nào?",
        "fc-retry-key",
        "req-fc-retry-2",
        agent,
    )
    assert status == 200
    assert body.get("route") in {"L1", "L2"}
    assert agent.calls == 2
    rows = db_session.execute(select(Message).where(Message.conversation_id == conversation_id)).scalars().all()
    assert len([row for row in rows if row.sender == "student"]) == 1
    assert any(row.sender == "assistant" for row in rows)
    record = _idempotency(db_session, "fc-retry-key")
    assert record.status == "completed"
    assert record.http_status == 200
    operation = db_session.execute(
        select(IntakeOperation).where(IntakeOperation.conversation_id == conversation_id)
    ).scalar_one()
    assert operation.state == "completed"


@pytest.mark.asyncio
async def test_terminal_schema_error_replays_same_key_without_calling_agent(db_session, restore_agent):
    student = _user(db_session, "SV-DEMO-001")
    conversation_id = await _start_conversation(db_session, student, "term")

    class CountingSchema(_RaisingAgent):
        def __init__(self):
            super().__init__("OUTPUT_SCHEMA_INVALID", stage="intake")
            self.calls = 0

        async def run_intake(self, context):
            self.calls += 1
            return await super().run_intake(context)

    first_agent = CountingSchema()
    with pytest.raises(ApiError) as first:
        await send_conversation_message(
            db_session,
            student,
            conversation_id,
            "Quy trình cấp giấy xác nhận sinh viên như thế nào?",
            "fc-term-key",
            "req-fc-term-1",
            first_agent,
        )
    assert first.value.status_code == 422
    record = _idempotency(db_session, "fc-term-key")
    assert record.status == "completed"
    assert record.http_status == 422
    assert record.response_json["error"]["code"] == "AI_OUTPUT_INVALID"
    second_agent = CountingSchema()
    status, body = await send_conversation_message(
        db_session,
        student,
        conversation_id,
        "Quy trình cấp giấy xác nhận sinh viên như thế nào?",
        "fc-term-key",
        "req-fc-term-2",
        second_agent,
    )
    assert status == 422
    assert body["error"]["code"] == "AI_OUTPUT_INVALID"
    assert first_agent.calls == 1
    assert second_agent.calls == 0
    rows = db_session.execute(select(Message).where(Message.conversation_id == conversation_id)).scalars().all()
    assert len(rows) == 1
    assert rows[0].sender == "student"
