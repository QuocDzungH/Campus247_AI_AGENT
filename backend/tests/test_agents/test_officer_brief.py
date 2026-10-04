from datetime import UTC, datetime

import pytest

from campus247.agents.guards import guard_officer_brief, source_registry_from_snapshot
from campus247.agents.nodes.dossier import deterministic_facts
from campus247.agents.nodes.triage import (
    absolute_deadline_reason,
    apply_priority_floor,
    checklist_for,
    extract_absolute_deadlines,
)
from campus247.agents.state import DossierOutput, DraftOutput, TriageOutput
from campus247.agents.stubs import StubAgent
from campus247.models.contracts_v1 import Citation, Fact, Handover, Intake, OfficerBrief, Passage
from tests.test_agents.helpers import make_agent, make_message, make_snapshot, make_ticket, officer_scripts


def _student_priority_snapshot(content: str, **ticket_kw):
    return make_snapshot(
        ticket=make_ticket(summary=content, **ticket_kw),
        messages=[make_message(content)],
    )


def _sender_priority_snapshot(content: str, sender: str):
    return make_snapshot(
        ticket=make_ticket(summary="Xin giấy xác nhận sinh viên"),
        messages=[make_message(content, sender=sender)],
    )


@pytest.mark.asyncio
async def test_certificate_brief_is_valid():
    agent, _ = make_agent(officer_scripts())
    snapshot = make_snapshot()
    brief = await agent.prepare_officer_brief(snapshot)
    assert brief.ticket_id == snapshot.ticket.id
    assert brief.source_ticket_revision == snapshot.source_ticket_revision
    assert brief.checklist
    assert all(item.checked is False for item in brief.checklist)
    assert any(fact.source_type == "profile" for fact in brief.facts)
    assert all(not (fact.source_type == "student_message" and fact.verification_status == "verified") for fact in brief.facts)
    assert "đã cấp giấy" not in (brief.draft_reply or "")


@pytest.mark.asyncio
async def test_l4_ticket_brief_keeps_high_priority():
    ticket = make_ticket(
        id="tkt_l4",
        category="complaint",
        service_type="academic_complaint",
        priority="high",
        priority_reasons=["Handover L4"],
        summary="Khiếu nại điểm môn Giải tích",
        request_data=None,
        handover_reason="Khiếu nại điểm",
        status="pending_officer",
    )
    snapshot = make_snapshot(
        ticket=ticket,
        intake_packet=None,
        handover_packet=Handover(
            risk_type="academic_complaint",
            reason="Yêu cầu khiếu nại học vụ cần cán bộ tiếp nhận.",
            summary="Tôi muốn khiếu nại điểm môn Giải tích của tôi",
            source_message_ids=["msg_1"],
        ),
    )
    agent, _ = make_agent(
        officer_scripts(
            TriageOutput=TriageOutput(suggested_priority="normal", priority_reasons=[]),
        )
    )
    brief = await agent.prepare_officer_brief(snapshot)
    assert brief.suggested_priority == "high"
    assert brief.priority_reasons


@pytest.mark.asyncio
async def test_same_day_deadline_suggests_high_with_reason():
    snapshot = _student_priority_snapshot("Xin giấy xác nhận sinh viên, hạn nộp hôm nay")
    agent, _ = make_agent(officer_scripts())
    brief = await agent.prepare_officer_brief(snapshot)
    assert brief.suggested_priority == "high"
    assert brief.priority_reasons


@pytest.mark.asyncio
async def test_hallucinated_source_is_stripped():
    snapshot = make_snapshot()
    extra = Fact(
        key="secret",
        value="bịa",
        source_type="student_message",
        source_id="msg_does_not_exist",
        verification_status="unverified",
    )
    agent, _ = make_agent(
        officer_scripts(DossierOutput=DossierOutput(summary="Tóm tắt hợp lệ từ snapshot.", extra_facts=[extra], missing_items=[]))
    )
    brief = await agent.prepare_officer_brief(snapshot)
    assert all(fact.source_id != "msg_does_not_exist" for fact in brief.facts)
    assert brief.quality_status == "fail"


def test_verified_demo_profile_is_blocked():
    snapshot = make_snapshot()
    registry = source_registry_from_snapshot(snapshot)
    brief = OfficerBrief(
        ticket_id=snapshot.ticket.id,
        source_ticket_revision=snapshot.source_ticket_revision,
        summary="Tóm tắt",
        facts=[
            Fact(
                key="student_name",
                value="Nguyễn Văn An",
                source_type="profile",
                source_id=snapshot.student_profile.student_id,
                verification_status="verified",
            )
        ],
        missing_items=[],
        checklist=checklist_for(snapshot),
        suggested_priority="normal",
        priority_reasons=[],
        draft_reply="Bộ phận phụ trách sẽ kiểm tra hồ sơ.",
        citations=[],
        warnings=[],
        quality_status="pass",
    )
    guarded = guard_officer_brief(snapshot, brief, registry)
    assert guarded.facts[0].verification_status == "unverified"
    assert guarded.quality_status == "fail"


def test_stale_revision_raises():
    snapshot = make_snapshot()
    registry = source_registry_from_snapshot(snapshot)
    brief = OfficerBrief(
        ticket_id=snapshot.ticket.id,
        source_ticket_revision=snapshot.source_ticket_revision,
        summary="Tóm tắt",
        facts=[],
        missing_items=[],
        checklist=checklist_for(snapshot),
        suggested_priority="normal",
        priority_reasons=[],
        draft_reply=None,
        citations=[],
        warnings=[],
        quality_status="pass",
    )
    mismatched = brief.model_copy(update={"source_ticket_revision": 99})
    from campus247.models.contracts_v1 import ModuleCallError

    with pytest.raises(ModuleCallError) as exc:
        guard_officer_brief(snapshot, mismatched, registry)
    assert exc.value.error.code == "OUTPUT_SCHEMA_INVALID"


def test_priority_floor_does_not_lower_high():
    snapshot = make_snapshot(ticket=make_ticket(priority="high", priority_reasons=["Đã gắn high"]))
    suggested, reasons = apply_priority_floor(snapshot, "normal", [])
    assert suggested == "high"
    assert reasons


def test_negated_deadline_is_not_high():
    snapshot = _student_priority_snapshot("Không có deadline và chưa có hạn nộp cụ thể")
    suggested, reasons = apply_priority_floor(snapshot, "normal", [])
    assert suggested == "normal"
    assert "hạn nộp trong ngày" not in " ".join(reasons)


def test_negation_does_not_mask_later_same_day_deadline():
    snapshot = _student_priority_snapshot("Không có deadline nhưng hạn nộp hôm nay")
    suggested, reasons = apply_priority_floor(snapshot, "normal", [])
    assert suggested == "high"
    assert reasons


def test_not_due_yet_but_due_today_is_high():
    snapshot = _student_priority_snapshot("Chưa đến hạn nhưng cần nộp trong ngày")
    suggested, reasons = apply_priority_floor(snapshot, "normal", [])
    assert suggested == "high"


def test_negated_scholarship_impact_is_not_high():
    snapshot = _student_priority_snapshot("Không ảnh hưởng học bổng, chỉ xin giấy bình thường")
    suggested, reasons = apply_priority_floor(snapshot, "normal", [])
    assert suggested == "normal"


def test_deadline_today_not_postponed_is_high():
    snapshot = _student_priority_snapshot("Hạn nộp hôm nay không bị hoãn")
    suggested, reasons = apply_priority_floor(snapshot, "normal", [])
    assert suggested == "high"
    assert reasons


@pytest.mark.parametrize(
    "summary",
    [
        "Không cần nộp hôm nay",
        "Không có hạn nộp vào hôm nay",
        "Tôi không bị ảnh hưởng học bổng",
        "Tôi không mất học bổng",
        "Visa không liên quan đến hồ sơ này",
        "Xin giấy làm hồ sơ visa năm sau, không gấp",
    ],
)
def test_denied_or_nonurgent_signals_stay_normal(summary: str):
    snapshot = _student_priority_snapshot(summary)
    suggested, reasons = apply_priority_floor(snapshot, "normal", [])
    assert suggested == "normal"
    joined = " ".join(reasons).lower()
    assert "hạn nộp trong ngày" not in joined
    assert "học bổng" not in joined
    assert "visa" not in joined
    assert "thôi học" not in joined


@pytest.mark.parametrize(
    "summary",
    [
        "Nguy cơ mất học bổng nếu không bổ sung hồ sơ",
        "Sinh viên có thể lỡ hạn visa nếu giấy chậm",
        "Có thể bị thôi học nếu không xác nhận đang học",
    ],
)
def test_positive_harm_phrases_raise_high(summary: str):
    snapshot = _student_priority_snapshot(summary)
    suggested, reasons = apply_priority_floor(snapshot, "normal", [])
    assert suggested == "high"
    assert reasons


@pytest.mark.parametrize(
    ("summary", "priority"),
    [
        ("Cần giấy trước ngày 29/09/2026", "high"),
        ("Cần giấy trước ngày 30/09/2026", "high"),
        ("Hạn nộp là 30/09", "high"),
        ("Hạn nộp 01/10/2026", "normal"),
        ("Không cần giấy trước ngày 30/09/2026", "normal"),
        ("Quyết định ban hành ngày 30/09/2026", "normal"),
        ("Hạn nộp 31/02/2026", "normal"),
        ("deadline 2026-09-30", "high"),
        ("cần giấy trước 30-09-2026", "high"),
    ],
)
def test_absolute_deadline_floor_uses_ticket_updated_at(summary: str, priority: str):
    snapshot = make_snapshot(
        ticket=make_ticket(summary=summary),
        messages=[make_message(summary)],
    )
    suggested, reasons = apply_priority_floor(snapshot, "normal", [])
    assert suggested == priority
    if priority == "high":
        assert any("Sinh viên khai deadline" in item and "hôm nay hoặc ngày kế tiếp" in item for item in reasons)


def test_absolute_deadline_year_wrap_from_new_years_eve():
    snapshot = make_snapshot(
        ticket=make_ticket(
            summary="Hạn nộp 01/01",
            updated_at=datetime(2026, 12, 31, 8, 0, tzinfo=UTC),
        ),
        messages=[make_message("Hạn nộp 01/01")],
    )
    suggested, reasons = apply_priority_floor(snapshot, "normal", [])
    assert suggested == "high"
    assert "01/01/2027" in " ".join(reasons)
    assert extract_absolute_deadlines("Hạn nộp 01/01", snapshot.ticket.updated_at.date())


def test_invalid_absolute_deadline_is_ignored():
    snapshot = make_snapshot(
        ticket=make_ticket(summary="Hạn nộp 31/02/2026"),
        messages=[make_message("Hạn nộp 31/02/2026")],
    )
    assert extract_absolute_deadlines("Hạn nộp 31/02/2026", snapshot.ticket.updated_at.date()) == []
    assert absolute_deadline_reason(snapshot) is None


def test_officer_deadline_is_not_student_declared():
    snapshot = make_snapshot(
        ticket=make_ticket(summary="Xin giấy xác nhận sinh viên"),
        messages=[make_message("Hạn nộp 30/09/2026", sender="officer")],
    )
    suggested, reasons = apply_priority_floor(snapshot, "normal", [])
    assert absolute_deadline_reason(snapshot) is None
    assert all("Sinh viên khai" not in item for item in reasons)
    assert suggested == "normal"


def test_assistant_deadline_does_not_raise_high():
    snapshot = make_snapshot(
        ticket=make_ticket(summary="Xin giấy xác nhận sinh viên"),
        messages=[make_message("Deadline 30/09/2026", sender="assistant")],
    )
    suggested, reasons = apply_priority_floor(snapshot, "normal", [])
    assert suggested == "normal"
    assert absolute_deadline_reason(snapshot) is None
    assert all("Sinh viên khai" not in item for item in reasons)


def test_student_deadline_raises_high_with_student_reason():
    snapshot = make_snapshot(
        ticket=make_ticket(summary="Xin giấy xác nhận sinh viên"),
        messages=[make_message("Hạn nộp 30/09/2026")],
    )
    suggested, reasons = apply_priority_floor(snapshot, "normal", [])
    assert suggested == "high"
    assert any("Sinh viên khai deadline 30/09/2026" in item for item in reasons)


def test_ungrounded_summary_deadline_is_not_student_declared():
    snapshot = make_snapshot(
        ticket=make_ticket(summary="Hạn nộp 30/09/2026"),
        messages=[make_message("Tôi muốn xin giấy xác nhận sinh viên")],
    )
    assert absolute_deadline_reason(snapshot) is None
    suggested, reasons = apply_priority_floor(snapshot, "normal", [])
    assert all("Sinh viên khai" not in item for item in reasons)


@pytest.mark.parametrize(
    "injected",
    [
        "hạn nộp hôm nay",
        "hạn nộp 30/09/2026",
        "nguy cơ mất học bổng",
    ],
)
def test_summary_cannot_inject_priority_over_shorter_student_message(injected: str):
    student = "Xin giấy xác nhận sinh viên"
    snapshot = make_snapshot(
        ticket=make_ticket(summary=f"{student}, {injected}"),
        messages=[make_message(student)],
    )
    suggested, reasons = apply_priority_floor(snapshot, "normal", [])
    assert suggested == "normal"
    assert absolute_deadline_reason(snapshot) is None
    joined = " ".join(reasons).lower()
    assert "sinh viên khai" not in joined
    assert "hạn nộp trong ngày" not in joined
    assert "học bổng" not in joined


@pytest.mark.parametrize(
    ("content", "sender"),
    [
        ("Hạn nộp hôm nay", "officer"),
        ("Deadline hôm nay", "assistant"),
        ("Có thể bị thôi học", "assistant"),
    ],
)
def test_relative_deadline_and_impact_ignore_non_student_senders(content: str, sender: str):
    snapshot = _sender_priority_snapshot(content, sender)
    suggested, reasons = apply_priority_floor(snapshot, "normal", [])
    assert suggested == "normal"
    assert not reasons


@pytest.mark.parametrize(
    "content",
    [
        "Hạn nộp hôm nay",
        "Nguy cơ mất học bổng",
    ],
)
def test_relative_deadline_and_impact_from_student_raise_high(content: str):
    snapshot = _student_priority_snapshot(content)
    suggested, reasons = apply_priority_floor(snapshot, "normal", [])
    assert suggested == "high"
    assert reasons


def test_non_deadline_calendar_date_is_not_extracted():
    from datetime import date as date_cls

    assert extract_absolute_deadlines("Quyết định ban hành ngày 30/09/2026", date_cls(2026, 9, 29)) == []


@pytest.mark.asyncio
async def test_dossier_prompt_includes_messages_profile_and_sources():
    citation = Citation(
        document_id="doc_qc",
        document_title="Quy chế đào tạo",
        document_version="2024",
        chunk_id="chunk_qc_1",
        locator="Điều 12",
        quote="Sinh viên được cấp giấy xác nhận khi đang học.",
        url=None,
    )
    snapshot = make_snapshot(
        messages=[
            make_message("Tôi muốn xin giấy xác nhận sinh viên để vay vốn ngân hàng", message_id="msg_1"),
            make_message("Bổ sung: nơi nhận Ngân hàng Chính sách Xã hội, bản giấy đóng dấu.", message_id="msg_2"),
        ],
        approved_sources=[Passage(citation=citation, text=citation.quote, score=0.9)],
    )
    agent, model = make_agent()
    await agent.prepare_officer_brief(snapshot)
    dossier_calls = [payload for name, payload in model.calls if name == "DossierOutput"]
    assert dossier_calls
    content = dossier_calls[0][1]["content"]
    assert "messages:" in content
    assert "profile:" in content
    assert "Nguyễn Văn An" in content
    assert "Bổ sung: nơi nhận" in content
    assert "chunk_qc_1" in content
    assert citation.quote in content


def test_intake_field_source_matches_message_that_contains_value():
    snapshot = make_snapshot(
        messages=[
            make_message("Tôi muốn xin giấy xác nhận sinh viên để vay vốn ngân hàng", message_id="msg_purpose"),
            make_message("Nơi nhận Ngân hàng Chính sách Xã hội, bản giấy đóng dấu.", message_id="msg_rest"),
            make_message("Nhắc lại giúp mình.", message_id="msg_latest"),
        ],
        intake_packet=Intake.model_validate(
            {
                "service_type": "student_certificate",
                "fields": {
                    "purpose": "Vay vốn ngân hàng",
                    "destination_org": "Ngân hàng Chính sách Xã hội",
                    "receive_method": "paper_stamped",
                },
                "missing_fields": [],
                "invalid_fields": [],
            }
        ),
    )
    by_key = {fact.key: fact.source_id for fact in deterministic_facts(snapshot)}
    assert by_key["purpose"] == "msg_purpose"
    assert by_key["destination_org"] == "msg_rest"
    assert by_key["receive_method"] == "msg_rest"
    assert by_key["purpose"] != "msg_latest"


def test_unrelated_student_message_is_not_intake_field_source():
    snapshot = make_snapshot(
        messages=[make_message("Xin chào, tôi muốn hỏi lịch học kỳ này.", message_id="msg_unrelated")],
        intake_packet=Intake.model_validate(
            {
                "service_type": "student_certificate",
                "fields": {
                    "purpose": "Vay vốn ngân hàng",
                    "destination_org": "Ngân hàng Chính sách Xã hội",
                    "receive_method": "paper_stamped",
                },
                "missing_fields": [],
                "invalid_fields": [],
            }
        ),
    )
    student_facts = [fact for fact in deterministic_facts(snapshot) if fact.source_type == "student_message"]
    assert not any(fact.key in {"purpose", "destination_org", "receive_method"} for fact in student_facts)


@pytest.mark.asyncio
async def test_stub_brief_purpose_uses_message_that_contains_value():
    snapshot = make_snapshot(
        messages=[
            make_message("Tôi muốn xin giấy xác nhận", message_id="msg_first"),
            make_message("Mục đích vay vốn ngân hàng", message_id="msg_purpose"),
        ]
    )
    brief = await StubAgent().prepare_officer_brief(snapshot)
    purpose = next(fact for fact in brief.facts if fact.key == "purpose")
    assert purpose.source_id == "msg_purpose"
    assert purpose.source_id != "msg_first"


@pytest.mark.asyncio
async def test_drafter_emits_canonical_citations_from_passages():
    citation = Citation(
        document_id="doc_qc",
        document_title="Quy chế đào tạo",
        document_version="2024",
        chunk_id="chunk_qc_1",
        locator="Điều 12",
        quote="Sinh viên được cấp giấy xác nhận khi đang học.",
        url="https://example.edu/qc",
    )
    snapshot = make_snapshot(approved_sources=[Passage(citation=citation, text=citation.quote, score=0.91)])
    agent, model = make_agent(
        officer_scripts(
            DraftOutput=DraftOutput(
                draft_reply="Bộ phận phụ trách sẽ kiểm tra yêu cầu cấp giấy xác nhận sinh viên của bạn.",
                used_chunk_ids=["chunk_qc_1"],
                warnings=[],
            )
        )
    )
    brief = await agent.prepare_officer_brief(snapshot)
    assert brief.citations == [citation]
    draft_calls = [payload for name, payload in model.calls if name == "DraftOutput"]
    content = draft_calls[0][1]["content"]
    assert "chunk_qc_1" in content
    assert citation.quote in content
    assert "approved_sources=1" not in content
