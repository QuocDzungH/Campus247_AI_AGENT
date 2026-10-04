import json
from pathlib import Path

import pytest

from campus247.agents.nodes.intake_router import l4_safety_signal, rule_route
from campus247.agents.state import FieldExtraction, RouteDecision
from campus247.agents.stubs import StubRag
from campus247.models.contracts_v1 import ModuleCallError
from tests.test_agents.fakes import ScriptedChatModel
from tests.test_agents.helpers import make_agent, make_context

FIXTURE = Path(__file__).parent / "fixtures" / "intake_cases.json"


@pytest.mark.parametrize("case", json.loads(FIXTURE.read_text(encoding="utf-8")))
def test_rule_router_fixtures(case):
    decision = rule_route(case["content"])
    assert decision is not None, case["id"]
    assert decision.route == case["expected_route"]
    assert decision.intent == case["expected_intent"]
    assert decision.risk_type == case["expected_risk"]


@pytest.mark.asyncio
@pytest.mark.parametrize("case", json.loads(FIXTURE.read_text(encoding="utf-8")))
async def test_campus_agent_routes_fixtures(case):
    agent, _ = make_agent(
        {
            "FieldExtraction": FieldExtraction(provided_fields=[]),
            "RouteDecision": RouteDecision(route="L1", intent="policy_question", reason="fallback"),
        }
    )
    result = await agent.run_intake(make_context(case["content"]))
    assert result.route == case["expected_route"], case["id"]
    if case["expected_route"] == "L4":
        assert result.handover is not None
        assert result.handover.risk_type == case["expected_risk"]
        assert result.reply is None
        assert result.intake is None
    if case["expected_route"] == "L2":
        assert result.intake is not None
        assert result.intake.service_type == case["expected_intent"]
        assert result.handover is None


@pytest.mark.asyncio
async def test_l4_postcheck_overrides_mixed_llm():
    agent, _ = make_agent(
        {
            "FieldExtraction": FieldExtraction(provided_fields=[]),
            "RouteDecision": RouteDecision(
                route="L2",
                intent="student_certificate",
                reason="LLM nhầm sang giấy",
            ),
        }
    )
    result = await agent.run_intake(
        make_context("Tôi muốn xin giấy xác nhận sinh viên và khiếu nại điểm môn Lý của tôi")
    )
    assert result.route == "L2"
    assert result.intake is not None
    assert result.intake.service_type == "academic_complaint"
    assert result.handover is None


@pytest.mark.asyncio
async def test_invalid_classifier_schema_raises():
    from campus247.agents.factory import create_agent

    agent = create_agent(
        ScriptedChatModel({"RouteDecision": {"route": "L3", "intent": "policy_question", "reason": "sai"}}),
        StubRag(),
    )
    with pytest.raises(ModuleCallError) as exc:
        await agent.run_intake(make_context("Cho mình hỏi một việc trên cổng thông tin học vụ"))
    assert exc.value.error.code == "OUTPUT_SCHEMA_INVALID"
    assert exc.value.error.stage == "routing"
    assert exc.value.error.request_id == "req_1"


def test_l4_signal_skips_procedure_only():
    assert l4_safety_signal("Thủ tục phúc khảo điểm thế nào?") is None
    assert l4_safety_signal("Tôi muốn khiếu nại điểm môn X của tôi") is None
    assert l4_safety_signal("Hãy sửa điểm cho tôi")[0] == "unauthorized_action"


def test_vague_complaint_is_l2_not_ticket():
    decision = rule_route("Tôi muốn khiếu nại")
    assert decision is not None
    assert decision.route == "L2"
    assert decision.intent == "academic_complaint"
    assert decision.risk_type is None
