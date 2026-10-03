"""Contract-faithful stubs. They do not invent L1 citations or ticket codes."""

from campus247.agents.metadata import STUB_MODEL_NAME
from campus247.agents.nodes.intake_l2 import MSG_L2_REVIEW, MSG_L2_SELF_SUBMIT, asks_to_submit_on_behalf
from campus247.agents.provenance import deterministic_facts
from campus247.models.contracts_v1 import (
    Intake,
    IntakeContext,
    IntakeResult,
    OfficerBrief,
    RagRequest,
    RagResult,
    RetrievalRequest,
    RetrievalResult,
    TicketSnapshot,
)
from campus247.services.common import MSG_L1_EMPTY, RISK_ROUTING

WELLBEING = ("căng thẳng", "tinh thần", "sức khỏe tinh thần", "wellbeing")
COMPLAINT = ("khiếu nại", "phúc khảo", "khiếu nai")
UNAUTHORIZED = ("sửa điểm", "xem hồ sơ của sinh viên khác", "đổi điểm")
CERTIFICATE = ("giấy xác nhận", "xin giấy", "cấp giấy")


class StubRag:
    index_version = "stub-v0"

    async def retrieve_policy(self, request: RetrievalRequest) -> RetrievalResult:
        return RetrievalResult(status="empty", passages=[], index_version=self.index_version)

    async def answer_question(self, request: RagRequest) -> RagResult:
        return RagResult(status="insufficient_evidence", answer=MSG_L1_EMPTY, citations=[])


class StubAgent:
    """Deterministic intake used until LangGraph implements AgentPort."""

    def __init__(self, intake_result: IntakeResult | None = None, brief: OfficerBrief | None = None):
        self.intake_result = intake_result
        self.brief = brief

    def brief_artifact_metadata(self) -> dict[str, str | None]:
        return {
            "model_name": STUB_MODEL_NAME,
            "prompt_version": "1",
            "template_version": "1",
            "index_version": None,
        }

    async def run_intake(self, context: IntakeContext) -> IntakeResult:
        if self.intake_result is not None:
            return self.intake_result
        text = context.message.content.lower()
        if any(token in text for token in WELLBEING):
            return _handover(context, "wellbeing", "Có tín hiệu cần hỗ trợ sinh viên.")
        if any(token in text for token in UNAUTHORIZED):
            return _handover(context, "unauthorized_action", "Yêu cầu vượt thẩm quyền hệ thống.")
        if any(token in text for token in COMPLAINT):
            return _handover(context, "academic_complaint", "Sinh viên gửi khiếu nại học vụ.")
        if any(token in text for token in CERTIFICATE):
            return _certificate(context, text)
        return IntakeResult(
            route="L1",
            outcome="insufficient_evidence",
            reply=MSG_L1_EMPTY,
            citations=[],
            intake=None,
            handover=None,
        )

    async def prepare_officer_brief(self, snapshot: TicketSnapshot) -> OfficerBrief:
        if self.brief is not None:
            return self.brief
        ticket = snapshot.ticket
        facts = deterministic_facts(snapshot)
        return OfficerBrief(
            ticket_id=ticket.id,
            source_ticket_revision=snapshot.source_ticket_revision,
            summary=ticket.summary[:2000],
            facts=facts,
            missing_items=[],
            checklist=[{"id": "check_profile", "label": "Kiểm tra tình trạng học tập", "checked": False}],
            suggested_priority=ticket.priority,
            priority_reasons=list(ticket.priority_reasons),
            draft_reply="Phòng đã tiếp nhận yêu cầu. Cán bộ sẽ phản hồi sau khi kiểm tra hồ sơ.",
            citations=[],
            warnings=[],
            quality_status="pass",
        )


def _handover(context: IntakeContext, risk: str, reason: str) -> IntakeResult:
    RISK_ROUTING[risk]
    return IntakeResult(
        route="L4",
        outcome="handover_required",
        reply=None,
        citations=[],
        intake=None,
        handover={
            "risk_type": risk,
            "reason": reason,
            "summary": context.message.content[:1000],
            "source_message_ids": [context.message.id],
        },
    )


def _certificate(context: IntakeContext, text: str) -> IntakeResult:
    current = context.preview.fields if context.preview is not None else None
    purpose = current.purpose if current else None
    destination = current.destination_org if current else None
    method = current.receive_method if current else None
    if purpose is None and "để " in text:
        purpose = text.split("để ", 1)[1][:1000]
        if len(purpose) < 5:
            purpose = None
    if destination is None and "nơi nhận" in text:
        destination = text.split("nơi nhận", 1)[-1].strip(" :.")[:300] or None
    if method is None:
        if "điện tử" in text or "pdf" in text:
            method = "digital_pdf"
        elif "bản giấy" in text or "đóng dấu" in text:
            method = "paper_stamped"
    fields = {"purpose": purpose, "destination_org": destination, "receive_method": method}
    missing = [key for key, value in fields.items() if value is None]
    intake = Intake(service_type="student_certificate", fields=fields, missing_fields=missing, invalid_fields=[])
    if missing:
        return IntakeResult(
            route="L2",
            outcome="collecting",
            reply="Bạn cho biết mục đích, nơi nhận và cách nhận giấy (bản điện tử hoặc bản giấy đóng dấu).",
            citations=[],
            intake=intake,
            handover=None,
        )
    return IntakeResult(
        route="L2",
        outcome="preview_ready",
        reply=MSG_L2_SELF_SUBMIT if asks_to_submit_on_behalf(text) else MSG_L2_REVIEW,
        citations=[],
        intake=intake,
        handover=None,
    )
