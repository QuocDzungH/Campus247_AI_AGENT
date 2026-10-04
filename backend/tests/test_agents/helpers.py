from __future__ import annotations

from datetime import UTC, datetime

from campus247.agents.factory import create_agent
from campus247.agents.stubs import StubRag
from campus247.models.contracts_v1 import (
    Actor,
    Fields,
    Intake,
    Message,
    Preview,
    Profile,
    Ticket,
    TicketSnapshot,
)
from tests.test_agents.fakes import ScriptedChatModel

NOW = datetime(2026, 9, 29, 8, 0, tzinfo=UTC)


def make_profile(**overrides) -> Profile:
    data = {
        "student_id": "SV001",
        "full_name": "Nguyễn Văn An",
        "mssv": "SV001",
        "faculty": "CNTT",
        "cohort": "K17",
        "is_demo": True,
    }
    data.update(overrides)
    return Profile.model_validate(data)


def make_message(content: str, *, message_id: str = "msg_current", sender: str = "student") -> Message:
    return Message(
        id=message_id,
        conversation_id="conv_1",
        ticket_id=None,
        sender=sender,
        content=content,
        created_at=NOW,
    )


def make_preview(purpose=None, destination_org=None, receive_method=None, **overrides) -> Preview:
    from campus247.models.intake_fields import missing_fields_for

    fields = overrides.pop("fields", None) or Fields(
        purpose=purpose, destination_org=destination_org, receive_method=receive_method
    )
    service_type = overrides.get("service_type", "student_certificate")
    missing = missing_fields_for(service_type, fields)
    data = {
        "id": "prv_1",
        "version": 1,
        "service_type": service_type,
        "fields": fields,
        "missing_fields": missing,
        "invalid_fields": [],
        "can_submit": not missing,
        "expires_at": NOW,
    }
    data.update(overrides)
    return Preview.model_validate(data)


def make_context(content: str, *, preview=None, history=None, request_id: str = "req_1", message_id: str = "msg_current"):
    from campus247.models.contracts_v1 import IntakeContext

    return IntakeContext(
        request_id=request_id,
        conversation_id="conv_1",
        conversation_revision=1,
        actor=Actor(user_id="SV001", role="student"),
        student_profile=make_profile(),
        message=make_message(content, message_id=message_id),
        history=history or [],
        preview=preview,
        linked_ticket=None,
        policy_scope="academic",
        effective_at=NOW,
    )


def make_ticket(**overrides) -> Ticket:
    data = {
        "id": "tkt_001",
        "code": "TKT-2026-0001",
        "status": "open",
        "priority": "normal",
        "conversation_id": "conv_1",
        "student_id": "SV001",
        "category": "action",
        "service_type": "student_certificate",
        "priority_reasons": [],
        "summary": "Xin giấy xác nhận sinh viên để vay vốn",
        "request_data": Fields(
            purpose="Vay vốn ngân hàng",
            destination_org="Ngân hàng Chính sách Xã hội",
            receive_method="paper_stamped",
        ),
        "handover_reason": None,
        "assigned_officer_id": None,
        "revision": 1,
        "created_at": NOW,
        "updated_at": NOW,
    }
    data.update(overrides)
    return Ticket.model_validate(data)


def make_snapshot(**overrides) -> TicketSnapshot:
    ticket = overrides.pop("ticket", None) or make_ticket()
    messages = overrides.pop("messages", None)
    if messages is None:
        messages = [
            Message(
                id="msg_1",
                conversation_id="conv_1",
                ticket_id=ticket.id,
                sender="student",
                content=(
                    "Tôi muốn xin giấy xác nhận sinh viên để vay vốn, nơi nhận Ngân hàng Chính sách Xã hội, bản giấy đóng dấu."
                ),
                created_at=NOW,
            )
        ]
    data = {
        "ticket": ticket,
        "source_ticket_revision": ticket.revision,
        "student_profile": make_profile(),
        "messages": messages,
        "intake_packet": Intake(
            service_type="student_certificate",
            fields=ticket.request_data
            or Fields(purpose="Vay vốn ngân hàng", destination_org="Ngân hàng Chính sách", receive_method="paper_stamped"),
            missing_fields=[],
            invalid_fields=[],
        ),
        "handover_packet": None,
        "approved_sources": [],
        "existing_officer_draft": None,
        "request_id": "req_brief_1",
    }
    data.update(overrides)
    return TicketSnapshot.model_validate(data)


def officer_scripts(**overrides) -> dict:
    from campus247.agents.state import DossierOutput, DraftOutput, TriageOutput

    scripts = {
        "DossierOutput": DossierOutput(
            summary="Sinh viên khai báo cần giấy xác nhận để vay vốn ngân hàng.",
            extra_facts=[],
            missing_items=[],
        ),
        "TriageOutput": TriageOutput(suggested_priority="normal", priority_reasons=[]),
        "DraftOutput": DraftOutput(
            draft_reply="Bộ phận phụ trách sẽ kiểm tra yêu cầu cấp giấy xác nhận sinh viên của bạn và phản hồi sau khi rà soát hồ sơ.",
            warnings=[],
        ),
    }
    scripts.update(overrides)
    return scripts


def make_agent(by_schema: dict | None = None, **timeouts):
    model = ScriptedChatModel(by_schema or officer_scripts())
    return create_agent(model, StubRag(), **timeouts), model
