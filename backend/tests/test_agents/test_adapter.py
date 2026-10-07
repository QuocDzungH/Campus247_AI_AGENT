import pytest

from campus247.agents.factory import create_agent
from campus247.agents.state import FieldExtraction
from campus247.agents.stubs import StubAgent, StubRag
from campus247.services.runtime import get_agent, get_rag
from tests.test_agents.fakes import ScriptedChatModel
from tests.test_agents.helpers import make_context, make_snapshot, officer_scripts


def test_default_runtime_is_stub():
    assert isinstance(get_agent(), StubAgent)
    assert isinstance(get_rag(), StubRag)


@pytest.mark.asyncio
async def test_campus_agent_l2_and_brief_integration():
    scripts = officer_scripts()
    scripts["FieldExtraction"] = FieldExtraction(
        provided_fields=["purpose", "destination_org", "receive_method"],
        purpose="Vay vốn ngân hàng",
        destination_org="Ngân hàng Chính sách Xã hội",
        receive_method="paper_stamped",
    )
    agent = create_agent(ScriptedChatModel(scripts), StubRag())
    intake = await agent.run_intake(
        make_context(
            "Tôi muốn xin giấy xác nhận sinh viên để vay vốn ngân hàng, nơi nhận Ngân hàng Chính sách Xã hội, bản giấy đóng dấu."
        )
    )
    assert intake.route == "L2"
    assert intake.outcome == "preview_ready"

    brief = await agent.prepare_officer_brief(make_snapshot())
    assert brief.ticket_id == "tkt_001"
    assert brief.quality_status in {"pass", "fail"}
    assert brief.checklist
    assert all(item.checked is False for item in brief.checklist)


@pytest.mark.asyncio
async def test_l1_uses_stub_rag_without_citations():
    agent = create_agent(ScriptedChatModel({}), StubRag())
    result = await agent.run_intake(make_context("Thủ tục phúc khảo điểm thế nào?"))
    assert result.route == "L1"
    assert result.outcome == "insufficient_evidence"
    assert result.citations == []
    assert result.intake is None
    assert result.handover is None
