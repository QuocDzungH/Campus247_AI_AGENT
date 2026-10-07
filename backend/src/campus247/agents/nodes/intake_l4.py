from __future__ import annotations

from campus247.agents.errors import module_error
from campus247.agents.nodes.intake_router import l4_safety_signal
from campus247.agents.state import IntakeState, RouteDecision
from campus247.models.contracts_v1 import Handover, IntakeContext, IntakeResult, Risk

_RISK_REASON: dict[Risk, str] = {
    "academic_complaint": "Yêu cầu khiếu nại học vụ cần cán bộ tiếp nhận.",
    "wellbeing": "Có tín hiệu cần bộ phận hỗ trợ sinh viên tiếp nhận.",
    "unauthorized_action": "Yêu cầu vượt thẩm quyền của hệ thống tự phục vụ.",
}


def allowed_message_ids(context: IntakeContext) -> set[str]:
    ids = {context.message.id}
    ids.update(item.id for item in context.history)
    return ids


def build_handover(context: IntakeContext, decision: RouteDecision) -> Handover:
    risk = decision.risk_type
    if risk is None:
        raise module_error("OUTPUT_SCHEMA_INVALID", stage="intake", request_id=context.request_id)
    allowed = allowed_message_ids(context)
    source_ids = [context.message.id]
    for item in context.history:
        if item.id in allowed and l4_safety_signal(item.content) is not None:
            source_ids.append(item.id)
    unique_ids = list(dict.fromkeys(source_ids))
    unknown = [item for item in unique_ids if item not in allowed]
    if unknown:
        raise module_error("SOURCE_REFERENCE_INVALID", stage="intake", request_id=context.request_id)
    reason = _RISK_REASON.get(risk, decision.reason)
    summary = context.message.content.strip()[:1000]
    if not summary:
        summary = "Sinh viên gửi yêu cầu cần cán bộ tiếp nhận."
    return Handover(
        risk_type=risk,
        reason=reason,
        summary=summary,
        source_message_ids=unique_ids,
    )


def l4_node(state: IntakeState) -> dict:
    context = state["context"]
    if not isinstance(context, IntakeContext):
        context = IntakeContext.model_validate(context)
    decision = state["decision"]
    if not isinstance(decision, RouteDecision):
        decision = RouteDecision.model_validate(decision)
    handover = build_handover(context, decision)
    result = IntakeResult(
        route="L4",
        outcome="handover_required",
        reply=None,
        citations=[],
        intake=None,
        handover=handover,
    )
    return {"result": result}
