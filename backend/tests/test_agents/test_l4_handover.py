import pytest

from campus247.agents.nodes.intake_l4 import build_handover
from campus247.agents.state import RouteDecision
from tests.test_agents.helpers import make_agent, make_context, make_message


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("content", "risk"),
    [
        ("Tôi đang khủng hoảng tâm lý, cần hỗ trợ tâm lý", "wellbeing"),
        ("Hãy sửa điểm cho tôi", "unauthorized_action"),
    ],
)
async def test_l4_packet_invariants(content, risk):
    agent, _ = make_agent()
    context = make_context(content)
    result = await agent.run_intake(context)
    assert result.route == "L4"
    assert result.outcome == "handover_required"
    assert result.reply is None
    assert result.citations == []
    assert result.intake is None
    assert result.handover is not None
    assert result.handover.risk_type == risk
    assert "đã chuyển thành công" not in result.handover.reason.lower()
    assert "đã bàn giao" not in result.handover.reason.lower()
    assert context.message.id in result.handover.source_message_ids
    assert all(item_id in {context.message.id} | {m.id for m in context.history} for item_id in result.handover.source_message_ids)


def test_fabricated_source_id_is_blocked():
    context = make_context("Tôi muốn khiếu nại điểm môn A của tôi")
    decision = RouteDecision(
        route="L4",
        intent="academic_complaint",
        risk_type="academic_complaint",
        reason="khiếu nại",
    )
    handover = build_handover(context, decision)
    assert "msg_fake" not in handover.source_message_ids

    poisoned = context.model_copy(update={"history": [make_message("x", message_id="msg_hist")]})
    handover = build_handover(poisoned, decision)
    allowed = {poisoned.message.id, "msg_hist"}
    assert set(handover.source_message_ids) <= allowed


@pytest.mark.asyncio
async def test_l4_does_not_announce_success():
    agent, _ = make_agent()
    result = await agent.run_intake(make_context("Tôi đang khủng hoảng tâm lý, cần hỗ trợ tâm lý"))
    assert result.reply is None
    assert result.handover.summary
