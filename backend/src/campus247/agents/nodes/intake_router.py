"""Safety and intent router: rule layer first, structured LLM for the remainder."""

from __future__ import annotations

import re
import time
from typing import Any

from pydantic import ValidationError

from campus247.agents.errors import module_error
from campus247.agents.llm_invoke import (
    INTAKE_BUDGET_SECONDS,
    PROVIDER_CALL_TIMEOUT_SECONDS,
    ainvoke_structured,
    remaining_timeout,
)
from campus247.agents.prompts.intake import INTAKE_ROUTER_SYSTEM
from campus247.agents.state import IntakeState, RouteDecision
from campus247.models.contracts_v1 import IntakeContext, Risk

_PROCEDURE = re.compile(
    r"(thủ tục|thu tuc|quy trình|quy trinh|nộp ở đâu|nop o dau|như thế nào|the nao|"
    r"cần giấy tờ gì|cần những giấy tờ|hướng dẫn|quy định|quy dinh|bao lâu|bao lau|"
    r"mất mấy ngày|bao nhiêu ngày|ở đâu|điều kiện gì|ai chịu trách nhiệm|có được phép|"
    r"có được tự|tỷ lệ.*là bao nhiêu|hạn chót|thời hạn|khung giờ nào|how can i|can i get|what are the)",
    re.IGNORECASE,
)
_PERSONAL_CASE = re.compile(
    r"(của tôi|cua toi|tôi muốn khiếu nại|toi muon khieu nai|tôi bị|toi bi|điểm của tôi|diem cua toi|môn .{1,80} của tôi)",
    re.IGNORECASE,
)
_NEGATE_COMPLAINT = re.compile(r"(không|khong) (phải |muốn )?khiếu nại", re.IGNORECASE)
_WELLBEING_STRONG = re.compile(
    r"(tự tử|tu tu|tự sát|tu sat|muốn chết|muon chet|không muốn sống|khong muon song|tự hại|tu hai|"
    r"trầm cảm|tram cam|khủng hoảng tâm lý|sức khỏe tinh thần|wellbeing|cần hỗ trợ tâm lý|tư vấn tâm lý|"
    r"không chịu nổi|nhảy lầu|kết thúc mọi thứ|không thiết tha sống|bế tắc|"
    r"kiệt sức.*cuộc sống|không thể tiếp tục cuộc sống|không làm chủ được hành vi)",
    re.IGNORECASE,
)
_WELLBEING_SOFT = re.compile(r"(căng thẳng|tinh thần|suy sụp|kiệt sức)", re.IGNORECASE)
_UNAUTHORIZED = re.compile(
    r"(sửa điểm|sua diem|đổi điểm|doi diem|xóa môn|xoa mon|huỷ môn|hủy môn|huy mon|"
    r"ghi điểm qua môn|cấp bằng tốt nghiệp sớm|bỏ qua mọi quy chế|"
    r"(xem|tra cứu|cho tôi).{0,40}(hồ sơ|điểm|email|thông tin|kỷ luật).{0,80}(sinh viên khác|bạn cùng lớp|sv\d+)|"
    r"ignore.*previous instructions|system override|dump.*token|bypass.*security|change my grade|hack)",
    re.IGNORECASE,
)
_UNAUTHORIZED_ASK = re.compile(
    r"(hãy|giúp tôi|cho tôi|please).{0,30}(sửa điểm|sua diem|xóa môn|xoa mon|đổi điểm|doi diem|change.*grade|set.*grade|bypass|dump|hack)",
    re.IGNORECASE,
)
_COMPLAINT = re.compile(
    r"(khiếu nại|khieu nai|khiếu nai|phúc khảo|phuc khao|điểm oan|diem oan|trừ điểm oan|không đồng ý với điểm)",
    re.IGNORECASE,
)
_COMPLAINT_ACTION = re.compile(
    r"(tôi muốn khiếu nại|muốn khiếu nại|toi muon khieu nai|gửi khiếu nại|nộp khiếu nại|nop khieu nai|"
    r"khiếu nại điểm|phúc khảo điểm|phuc khao diem|điểm oan|trừ điểm oan|không đồng ý với điểm|"
    r"điểm môn .{1,80} của tôi|điểm của tôi|tôi muốn phúc khảo|muon phuc khao|phuc khao mon|khiếu nại môn)",
    re.IGNORECASE,
)
_GRADE_HINT = re.compile(
    r"(điểm|diem|phúc khảo|phuc khao|học phần|môn )",
    re.IGNORECASE,
)
_CERT_ACTION = re.compile(
    r"(muốn xin giấy|xin cấp giấy|xin giấy xác nhận|cấp giấy xác nhận|"
    r"làm giấy xác nhận|giấy xác nhận sinh viên|cần giấy xác nhận|"
    r"lam giay xac nhan|xin giay xac nhan|can giay xac nhan|apply visa|request.*certification)",
    re.IGNORECASE,
)
_CERT_PROCEDURE = re.compile(
    r"((thủ tục|quy trình|cần gì|như thế nào|giấy tờ|the nao).{0,48}giấy xác nhận)"
    r"|(giấy xác nhận.{0,80}(thủ tục|như thế nào|cần gì|quy trình|giấy tờ|the nao))",
    re.IGNORECASE,
)


def _text(context: IntakeContext) -> str:
    return context.message.content.strip()


def l4_safety_signal(text: str) -> tuple[Risk, str] | None:
    """Clear L4 signals. Procedure-only questions are not L4."""
    lowered = text.strip()
    procedure = bool(_PROCEDURE.search(lowered))
    personal = bool(_PERSONAL_CASE.search(lowered))

    if _WELLBEING_STRONG.search(lowered):
        return "wellbeing", "Có tín hiệu cần bộ phận hỗ trợ sinh viên tiếp nhận."
    if _WELLBEING_SOFT.search(lowered) and not procedure:
        return "wellbeing", "Có tín hiệu cần bộ phận hỗ trợ sinh viên tiếp nhận."

    if _UNAUTHORIZED_ASK.search(lowered) or (_UNAUTHORIZED.search(lowered) and (not procedure or personal)):
        return "unauthorized_action", "Yêu cầu vượt thẩm quyền của hệ thống tự phục vụ."

    return None


def rule_route(text: str) -> RouteDecision | None:
    """Return a confident decision without calling the model, or None to classify."""
    l4 = l4_safety_signal(text)
    if l4 is not None:
        risk, reason = l4
        return RouteDecision(route="L4", intent=risk, risk_type=risk, reason=reason, confidence=0.95)

    procedure = bool(_PROCEDURE.search(text) or _CERT_PROCEDURE.search(text))
    cert_action = bool(_CERT_ACTION.search(text))
    complaint_action = bool(_COMPLAINT_ACTION.search(text) or (_COMPLAINT.search(text) and not procedure))
    if _NEGATE_COMPLAINT.search(text) and not _PERSONAL_CASE.search(text):
        complaint_action = False

    if procedure and not cert_action and not complaint_action:
        return RouteDecision(
            route="L1",
            intent="policy_question",
            reason="Sinh viên hỏi thủ tục, chưa yêu cầu xử lý một ca cụ thể.",
            confidence=0.9,
        )
    if procedure and (cert_action or complaint_action) and not _PERSONAL_CASE.search(text):
        return RouteDecision(
            route="L1",
            intent="policy_question",
            reason="Câu hỏi về thủ tục, chưa phải yêu cầu tạo hồ sơ.",
            confidence=0.8,
        )
    if cert_action and complaint_action:
        if _GRADE_HINT.search(text) and _PERSONAL_CASE.search(text):
            return RouteDecision(
                route="L2",
                intent="academic_complaint",
                reason="Sinh viên nêu khiếu nại cụ thể; giấy xác nhận có thể đổi loại đơn sau.",
                confidence=0.8,
            )
        return RouteDecision(
            route="L2",
            intent="student_certificate",
            reason="Sinh viên nêu xin giấy; có thể đổi sang khiếu nại nếu đó là nhu cầu chính.",
            confidence=0.75,
        )
    if complaint_action:
        return RouteDecision(
            route="L2",
            intent="academic_complaint",
            reason="Sinh viên muốn gửi khiếu nại trong hội thoại.",
            confidence=0.9,
        )
    if cert_action:
        return RouteDecision(
            route="L2",
            intent="student_certificate",
            reason="Sinh viên muốn tạo yêu cầu giấy xác nhận sinh viên.",
            confidence=0.9,
        )
    if _NEGATE_COMPLAINT.search(text):
        return RouteDecision(
            route="L1",
            intent="policy_question",
            reason="Sinh viên hỏi thông tin, không gửi khiếu nại.",
            confidence=0.85,
        )
    return None


def _user_payload(context: IntakeContext) -> str:
    history_lines = []
    for item in context.history[-8:]:
        history_lines.append(f"{item.sender}: {item.content}")
    history = "\n".join(history_lines) if history_lines else "(không có)"
    preview = "không có"
    if context.preview is not None:
        preview = context.preview.fields.model_dump_json()
    return (
        f"Tin hiện tại: {context.message.content}\n"
        f"Lịch sử gần đây:\n{history}\n"
        f"Preview hiện tại: {preview}"
    )


def make_router_node(model: Any, *, provider_timeout: float = PROVIDER_CALL_TIMEOUT_SECONDS):
    async def route_node(state: IntakeState) -> dict:
        context = state["context"]
        if not isinstance(context, IntakeContext):
            context = IntakeContext.model_validate(context)
        text = _text(context)
        if not text:
            raise module_error("OUTPUT_SCHEMA_INVALID", stage="routing", request_id=context.request_id)

        ruled = rule_route(text)
        if ruled is None and context.preview is not None and l4_safety_signal(text) is None:
            preview_intent = context.preview.service_type
            if preview_intent in {"student_certificate", "academic_complaint"}:
                ruled = RouteDecision(
                    route="L2",
                    intent=preview_intent,
                    reason="Tiếp tục thu thập hồ sơ đang mở trong hội thoại.",
                    confidence=0.9,
                )
        if ruled is not None:
            return {"context": context, "decision": ruled}

        messages = [
            {"role": "system", "content": INTAKE_ROUTER_SYSTEM},
            {"role": "user", "content": _user_payload(context)},
        ]
        started_at = float(state.get("started_at") or time.monotonic())
        timeout = remaining_timeout(started_at, INTAKE_BUDGET_SECONDS, provider_timeout)
        try:
            decision = await ainvoke_structured(
                model,
                RouteDecision,
                messages,
                stage="routing",
                request_id=context.request_id,
                timeout=timeout,
                retry_transient=True,
            )
        except ValidationError as exc:
            raise module_error("OUTPUT_SCHEMA_INVALID", stage="routing", request_id=context.request_id) from exc

        if not isinstance(decision, RouteDecision):
            try:
                decision = RouteDecision.model_validate(decision)
            except ValidationError as exc:
                raise module_error("OUTPUT_SCHEMA_INVALID", stage="routing", request_id=context.request_id) from exc

        override = l4_safety_signal(text)
        if override is not None:
            risk, reason = override
            decision = RouteDecision(route="L4", intent=risk, risk_type=risk, reason=reason, confidence=decision.confidence)
        return {"context": context, "decision": decision}

    return route_node
