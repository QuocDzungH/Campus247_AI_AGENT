import asyncio

import pytest

from campus247.agents.draft_templates import safe_template
from campus247.agents.guards import guard_officer_brief, sanitize_checklist, source_registry_from_snapshot
from campus247.agents.nodes.triage import checklist_for
from campus247.models.contracts_v1 import Citation, ModuleCallError, OfficerBrief, Passage
from tests.test_agents.fakes import ScriptedChatModel
from tests.test_agents.helpers import make_context, make_message, make_snapshot


def test_checklist_autotick_is_reset():
    items, warnings = sanitize_checklist([{"id": "cert_check_enrollment", "label": "Kiểm tra", "checked": True}])
    assert items[0].checked is False
    assert warnings


def _brief(snapshot, draft: str, *, citations=None, **overrides) -> OfficerBrief:
    data = {
        "ticket_id": snapshot.ticket.id,
        "source_ticket_revision": snapshot.source_ticket_revision,
        "summary": "Tóm tắt hồ sơ giấy xác nhận.",
        "facts": [],
        "missing_items": [],
        "checklist": checklist_for(snapshot),
        "suggested_priority": "normal",
        "priority_reasons": [],
        "draft_reply": draft,
        "citations": citations or [],
        "warnings": [],
        "quality_status": "pass",
    }
    data.update(overrides)
    return OfficerBrief.model_validate(data)


def _policy_citation() -> Citation:
    return Citation(
        document_id="doc_qc",
        document_title="Quy chế đào tạo",
        document_version="2024",
        chunk_id="chunk_qc_1",
        locator="Điều 12",
        quote="Sinh viên được cấp giấy xác nhận khi đang học.",
        url="https://example.edu/qc",
    )


@pytest.mark.parametrize(
    "draft",
    [
        "Chào [Tên sinh viên], hoàn tất giấy.",
        "TODO gửi phản hồi cho sinh viên.",
        "Nhà trường đã cấp giấy xác nhận sinh viên.",
        "Cam kết trả kết quả trong vòng 24 giờ.",
        "Theo quy chế đào tạo bạn đủ điều kiện nhận giấy.",
    ],
)
def test_unsafe_draft_is_replaced_with_safe_template(draft: str):
    snapshot = make_snapshot()
    guarded = guard_officer_brief(
        snapshot,
        _brief(snapshot, draft),
        source_registry_from_snapshot(snapshot),
    )
    expected = safe_template(snapshot.ticket.service_type)
    assert guarded.draft_reply == expected
    assert guarded.quality_status == "fail"
    assert guarded.citations == []
    warning = next(item for item in guarded.warnings if item.code == "unsafe_draft")
    assert "Đã thay bằng mẫu tiếp nhận an toàn." in warning.message
    assert "[Tên sinh viên]" not in expected
    assert "TODO" not in expected
    assert "đã cấp giấy" not in expected.lower()
    assert "theo quy chế" not in expected.lower()


def test_unsafe_draft_clears_approved_citations():
    citation = _policy_citation()
    snapshot = make_snapshot(approved_sources=[Passage(citation=citation, text=citation.quote, score=0.9)])
    guarded = guard_officer_brief(
        snapshot,
        _brief(snapshot, "Chào [Tên sinh viên].", citations=[citation]),
        source_registry_from_snapshot(snapshot),
    )
    assert guarded.citations == []
    assert guarded.draft_reply == safe_template(snapshot.ticket.service_type)
    assert guarded.quality_status == "fail"


def test_unsafe_draft_drops_error_citations():
    snapshot = make_snapshot()
    fake = _policy_citation().model_copy(update={"document_title": "Sách giả", "quote": "Bịa quote"})
    guarded = guard_officer_brief(
        snapshot,
        _brief(snapshot, "Chào [Tên sinh viên].", citations=[fake]),
        source_registry_from_snapshot(snapshot),
    )
    assert guarded.citations == []
    assert guarded.draft_reply == safe_template(snapshot.ticket.service_type)
    assert guarded.quality_status == "fail"


def test_existing_officer_draft_is_preserved_when_replacing_unsafe_draft():
    original = "Draft cán bộ đã lưu, không được ghi đè."
    snapshot = make_snapshot(existing_officer_draft=original)
    guarded = guard_officer_brief(
        snapshot,
        _brief(snapshot, "TODO gửi giấy."),
        source_registry_from_snapshot(snapshot),
    )
    assert snapshot.existing_officer_draft == original
    assert any(item.code == "existing_officer_draft" for item in guarded.warnings)
    assert guarded.draft_reply == safe_template(snapshot.ticket.service_type)
    assert guarded.quality_status == "fail"


def test_valid_draft_is_not_replaced():
    snapshot = make_snapshot()
    draft = "Bộ phận phụ trách sẽ kiểm tra hồ sơ."
    guarded = guard_officer_brief(snapshot, _brief(snapshot, draft), source_registry_from_snapshot(snapshot))
    assert guarded.draft_reply == draft
    assert guarded.quality_status == "pass"
    assert all(item.code != "unsafe_draft" for item in guarded.warnings)


def test_officer_messages_are_not_student_sources():
    snapshot = make_snapshot(
        messages=[
            make_message("Tôi muốn xin giấy xác nhận sinh viên", message_id="msg_s"),
            make_message("Ghi chú nội bộ", message_id="msg_o", sender="officer"),
            make_message("Hệ thống đã ghi nhận", message_id="msg_a", sender="assistant"),
        ]
    )
    registry = source_registry_from_snapshot(snapshot)
    assert ("student_message", "msg_s") in registry
    assert ("student_message", "msg_o") not in registry
    assert ("student_message", "msg_a") not in registry


def test_fabricated_citation_metadata_is_dropped():
    real = Citation(
        document_id="doc_qc",
        document_title="Quy chế đào tạo",
        document_version="2024",
        chunk_id="chunk_qc_1",
        locator="Điều 12",
        quote="Sinh viên được cấp giấy xác nhận khi đang học.",
        url="https://example.edu/qc",
    )
    snapshot = make_snapshot(approved_sources=[Passage(citation=real, text=real.quote, score=0.9)])
    fake = real.model_copy(update={"document_title": "Sách giả", "quote": "Bịa quote hoàn toàn", "locator": "p.99"})
    brief = OfficerBrief(
        ticket_id=snapshot.ticket.id,
        source_ticket_revision=snapshot.source_ticket_revision,
        summary="Tóm tắt",
        facts=[],
        missing_items=[],
        checklist=checklist_for(snapshot),
        suggested_priority="normal",
        priority_reasons=[],
        draft_reply="Bộ phận phụ trách sẽ kiểm tra hồ sơ.",
        citations=[fake],
        warnings=[],
        quality_status="pass",
    )
    guarded = guard_officer_brief(snapshot, brief, source_registry_from_snapshot(snapshot))
    assert guarded.citations == []
    assert guarded.quality_status == "fail"
    assert guarded.draft_reply == "Bộ phận phụ trách sẽ kiểm tra hồ sơ."


def test_unapproved_citation_is_dropped():
    snapshot = make_snapshot()
    citation = Citation(
        document_id="doc_x",
        document_title="Quy chế bịa",
        document_version="v1",
        chunk_id="chunk_x",
        locator="p.1",
        quote="Không có trong snapshot",
        url=None,
    )
    brief = OfficerBrief(
        ticket_id=snapshot.ticket.id,
        source_ticket_revision=snapshot.source_ticket_revision,
        summary="Tóm tắt",
        facts=[],
        missing_items=[],
        checklist=checklist_for(snapshot),
        suggested_priority="normal",
        priority_reasons=[],
        draft_reply="Bộ phận phụ trách sẽ kiểm tra hồ sơ.",
        citations=[citation],
        warnings=[],
        quality_status="pass",
    )
    guarded = guard_officer_brief(snapshot, brief, source_registry_from_snapshot(snapshot))
    assert guarded.citations == []
    assert guarded.quality_status == "fail"
    assert guarded.draft_reply == "Bộ phận phụ trách sẽ kiểm tra hồ sơ."


def test_high_priority_without_reason_raises():
    snapshot = make_snapshot()
    with pytest.raises(Exception):
        OfficerBrief(
            ticket_id=snapshot.ticket.id,
            source_ticket_revision=1,
            summary="Tóm tắt",
            facts=[],
            missing_items=[],
            checklist=checklist_for(snapshot),
            suggested_priority="high",
            priority_reasons=[],
            draft_reply=None,
            citations=[],
            warnings=[],
            quality_status="pass",
        )


@pytest.mark.asyncio
async def test_timeout_maps_to_provider_timeout():
    async def slow(_input):
        await asyncio.sleep(0.2)
        raise TimeoutError("slow")

    from campus247.agents.factory import create_agent
    from campus247.agents.stubs import StubRag

    agent = create_agent(
        ScriptedChatModel({"RouteDecision": slow}),
        StubRag(),
        intake_timeout=0.05,
        provider_timeout=0.05,
    )
    marker = {"done": False}

    async def other():
        await asyncio.sleep(0.01)
        marker["done"] = True

    with pytest.raises(ModuleCallError) as exc:
        await asyncio.gather(agent.run_intake(make_context("Cho mình hỏi một việc trên cổng thông tin")), other())
    assert exc.value.error.code == "PROVIDER_TIMEOUT"
    assert exc.value.error.request_id == "req_1"
    assert marker["done"] is True


@pytest.mark.asyncio
async def test_rate_limit_maps_code():
    class RateLimitError(Exception):
        pass

    from campus247.agents.factory import create_agent
    from campus247.agents.stubs import StubRag

    agent = create_agent(ScriptedChatModel({"RouteDecision": RateLimitError("429")}), StubRag())
    with pytest.raises(ModuleCallError) as exc:
        await agent.run_intake(make_context("Cho mình hỏi một việc trên cổng thông tin"))
    assert exc.value.error.code == "PROVIDER_RATE_LIMITED"
    assert exc.value.error.stage == "routing"
    assert exc.value.error.retryable is True


@pytest.mark.asyncio
async def test_l1_rag_error_is_not_converted_to_empty_answer():
    from campus247.agents.factory import create_agent
    from campus247.models.contracts_v1 import ModuleError, RagRequest, RagResult, RetrievalRequest, RetrievalResult

    class BoomRag:
        async def retrieve_policy(self, request: RetrievalRequest) -> RetrievalResult:
            return RetrievalResult(status="empty", passages=[], index_version="x")

        async def answer_question(self, request: RagRequest) -> RagResult:
            raise ModuleCallError(
                ModuleError(code="INDEX_UNAVAILABLE", retryable=True, stage="retrieval", request_id=request.question[:8])
            )

    agent = create_agent(ScriptedChatModel({}), BoomRag())
    with pytest.raises(ModuleCallError) as exc:
        await agent.run_intake(make_context("Thủ tục phúc khảo điểm thế nào?"))
    assert exc.value.error.code == "INDEX_UNAVAILABLE"


@pytest.mark.asyncio
async def test_l1_rag_timeout_maps_to_provider_timeout():
    from campus247.agents.factory import create_agent
    from campus247.models.contracts_v1 import RagRequest, RagResult, RetrievalRequest, RetrievalResult

    class SlowRag:
        async def retrieve_policy(self, request: RetrievalRequest) -> RetrievalResult:
            return RetrievalResult(status="empty", passages=[], index_version="x")

        async def answer_question(self, request: RagRequest) -> RagResult:
            await asyncio.sleep(1)
            return RagResult(status="insufficient_evidence", answer="timeout", citations=[])

    agent = create_agent(ScriptedChatModel({}), SlowRag(), intake_timeout=5, provider_timeout=0.05)
    with pytest.raises(ModuleCallError) as exc:
        await agent.run_intake(make_context("Thủ tục phúc khảo điểm thế nào?"))
    assert exc.value.error.code == "PROVIDER_TIMEOUT"
    assert exc.value.error.stage == "retrieval"
    assert exc.value.error.request_id == "req_1"
