import pytest

from campus247.agents.nodes.intake_l2 import (
    MSG_L2_REVIEW,
    MSG_L2_SELF_SUBMIT,
    asks_to_submit_on_behalf,
    build_l2_reply,
    merge_certificate_fields,
)
from campus247.agents.state import FieldExtraction, RouteDecision
from campus247.models.contracts_v1 import FieldIssue, Fields
from tests.test_agents.helpers import make_agent, make_context, make_preview


def _extract(**kwargs) -> FieldExtraction:
    return FieldExtraction.model_validate(kwargs)


def _agent_with_extraction(*extractions):
    scripts = {"FieldExtraction": list(extractions) if len(extractions) > 1 else extractions[0]}
    agent, model = make_agent(scripts)
    return agent, model


@pytest.mark.asyncio
async def test_single_message_complete_fields():
    agent, _ = _agent_with_extraction(
        _extract(
            provided_fields=["purpose", "destination_org", "receive_method"],
            purpose="Vay vốn ngân hàng",
            destination_org="Ngân hàng Chính sách Xã hội",
            receive_method="digital_pdf",
        )
    )
    result = await agent.run_intake(
        make_context(
            "Tôi muốn xin giấy xác nhận sinh viên để vay vốn ngân hàng, nơi nhận Ngân hàng Chính sách Xã hội, bản điện tử PDF."
        )
    )
    assert result.route == "L2"
    assert result.outcome == "preview_ready"
    assert result.intake.fields.purpose == "Vay vốn ngân hàng"
    assert result.intake.fields.destination_org == "Ngân hàng Chính sách Xã hội"
    assert result.intake.fields.receive_method == "digital_pdf"
    assert result.intake.missing_fields == []


@pytest.mark.asyncio
async def test_three_turns_fill_one_field_each():
    agent, _ = _agent_with_extraction(
        _extract(provided_fields=["purpose"], purpose="Thực tập tại doanh nghiệp"),
        _extract(provided_fields=["destination_org"], destination_org="Công ty ABC"),
        _extract(provided_fields=["receive_method"], receive_method="paper_stamped"),
    )
    first = await agent.run_intake(make_context("Tôi muốn xin giấy xác nhận sinh viên để thực tập tại doanh nghiệp"))
    assert first.outcome == "collecting"
    assert first.intake.fields.purpose == "Thực tập tại doanh nghiệp"
    assert set(first.intake.missing_fields) == {"destination_org", "receive_method"}

    preview = make_preview(purpose=first.intake.fields.purpose)
    second = await agent.run_intake(make_context("Nơi nhận là Công ty ABC", preview=preview, message_id="msg_2"))
    assert second.intake.fields.destination_org == "Công ty ABC"
    assert second.intake.fields.purpose == "Thực tập tại doanh nghiệp"
    assert second.outcome == "collecting"

    preview2 = make_preview(purpose=second.intake.fields.purpose, destination_org=second.intake.fields.destination_org)
    third = await agent.run_intake(make_context("Nhận bản giấy đóng dấu", preview=preview2, message_id="msg_3"))
    assert third.outcome == "preview_ready"
    assert third.intake.fields.receive_method == "paper_stamped"


@pytest.mark.asyncio
async def test_later_turn_updates_receive_method():
    agent, _ = _agent_with_extraction(
        _extract(provided_fields=["receive_method"], receive_method="digital_pdf"),
    )
    preview = make_preview(
        purpose="Vay vốn ngân hàng",
        destination_org="Ngân hàng A",
        receive_method="paper_stamped",
    )
    result = await agent.run_intake(make_context("Đổi sang bản điện tử PDF giúp bạn", preview=preview))
    assert result.outcome == "preview_ready"
    assert result.intake.fields.receive_method == "digital_pdf"
    assert result.intake.fields.purpose == "Vay vốn ngân hàng"


@pytest.mark.asyncio
async def test_urgent_word_does_not_fill_purpose():
    agent, _ = _agent_with_extraction(_extract(provided_fields=["purpose"], purpose="gấp"))
    result = await agent.run_intake(make_context("Tôi muốn xin giấy xác nhận sinh viên, gấp"))
    assert result.outcome == "collecting"
    assert result.intake.fields.purpose is None
    assert "purpose" in result.intake.missing_fields or any(item.field == "purpose" for item in result.intake.invalid_fields)


@pytest.mark.asyncio
async def test_invalid_receive_method():
    agent, _ = _agent_with_extraction(
        _extract(
            provided_fields=["receive_method"],
            receive_method=None,
            invalid_fields=[FieldIssue(field="receive_method", reason="Không hỗ trợ nhận tại nhà")],
        )
    )
    result = await agent.run_intake(make_context("Tôi muốn xin giấy xác nhận sinh viên, gửi về nhà giúp tôi"))
    assert result.outcome == "collecting"
    assert any(item.field == "receive_method" for item in result.intake.invalid_fields)


@pytest.mark.asyncio
async def test_preview_two_fields_message_adds_third():
    agent, _ = _agent_with_extraction(
        _extract(provided_fields=["destination_org"], destination_org="Sở Giáo dục")
    )
    preview = make_preview(purpose="Xin việc", receive_method="digital_pdf")
    result = await agent.run_intake(make_context("Nơi nhận Sở Giáo dục", preview=preview))
    assert result.outcome == "preview_ready"
    assert result.intake.fields.destination_org == "Sở Giáo dục"
    assert result.intake.fields.purpose == "Xin việc"


@pytest.mark.asyncio
async def test_complaint_while_l2_preview_switches_form_without_ticket():
    agent, _ = _agent_with_extraction(_extract(provided_fields=[]))
    preview = make_preview(purpose="Vay vốn ngân hàng", destination_org="NH A")
    result = await agent.run_intake(
        make_context("Tôi muốn khiếu nại điểm môn Toán của tôi", preview=preview)
    )
    assert result.route == "L2"
    assert result.intake is not None
    assert result.intake.service_type == "academic_complaint"
    assert result.handover is None
    assert result.intake.fields.course == "Toán"
    assert result.intake.fields.complaint_subtype == "grade_appeal"
    assert "purpose" not in result.intake.fields.model_dump() or result.intake.fields.purpose is None


def test_preview_ready_asks_user_to_self_submit():
    assert asks_to_submit_on_behalf("Tôi đã xác nhận ok rồi gửi giúp tôi")
    assert asks_to_submit_on_behalf("Mình tự gửi nhé")
    assert not asks_to_submit_on_behalf("Nơi tôi nộp giấy là công ty FPT software")
    assert build_l2_reply([], [], preview_ready=True) == MSG_L2_REVIEW
    assert (
        build_l2_reply([], [], preview_ready=True, user_message="Tôi đã xác nhận ok rồi gửi giúp tôi")
        == MSG_L2_SELF_SUBMIT
    )
    assert (
        build_l2_reply(
            ["destination_org"],
            [],
            preview_ready=False,
            user_message="Gửi giúp tôi",
        )
        == "Bạn cho biết nơi nộp giấy."
    )


@pytest.mark.asyncio
async def test_complete_preview_send_on_behalf_does_not_submit():
    agent, _ = _agent_with_extraction(_extract(provided_fields=[]))
    preview = make_preview(
        purpose="xin giấy xác nhận sinh viên giỏi",
        destination_org="công ty FPT software",
        receive_method="paper_stamped",
    )
    result = await agent.run_intake(
        make_context("Tôi đã xác nhận ok rồi gửi giúp tôi", preview=preview)
    )
    assert result.route == "L2"
    assert result.outcome == "preview_ready"
    assert result.reply == MSG_L2_SELF_SUBMIT


def test_merge_does_not_overwrite_with_none():
    existing = Fields(purpose="Vay vốn ngân hàng", destination_org=None, receive_method=None)
    fields, invalid = merge_certificate_fields(
        existing,
        _extract(provided_fields=["destination_org"], destination_org="NH B"),
    )
    assert fields.purpose == "Vay vốn ngân hàng"
    assert fields.destination_org == "NH B"
    assert invalid == []


@pytest.mark.asyncio
async def test_vague_complaint_asks_topic_and_does_not_submit():
    agent, _ = _agent_with_extraction(_extract(provided_fields=[]))
    result = await agent.run_intake(make_context("Tôi muốn khiếu nại"))
    assert result.route == "L2"
    assert result.outcome == "collecting"
    assert result.intake.service_type == "academic_complaint"
    assert "complaint_subtype" in result.intake.missing_fields
    assert result.reply == "Bạn muốn khiếu nại về vấn đề gì?"


@pytest.mark.asyncio
async def test_grade_complaint_opens_form_fields():
    agent, _ = _agent_with_extraction(_extract(provided_fields=[]))
    result = await agent.run_intake(
        make_context("Tôi muốn khiếu nại điểm môn Cơ sở dữ liệu vì điểm bài thi chưa đúng.")
    )
    assert result.route == "L2"
    assert result.intake.service_type == "academic_complaint"
    assert result.intake.fields.complaint_subtype == "grade_appeal"
    assert result.intake.fields.course == "Cơ sở dữ liệu"
    assert result.intake.fields.description
    assert result.handover is None


@pytest.mark.asyncio
async def test_procedure_question_is_not_a_form():
    agent, _ = make_agent(
        {
            "FieldExtraction": _extract(provided_fields=[]),
            "RouteDecision": RouteDecision(route="L1", intent="policy_question", reason="fallback"),
        }
    )
    result = await agent.run_intake(make_context("Quy trình khiếu nại điểm?"))
    assert result.route == "L1"
    assert result.intake is None


@pytest.mark.asyncio
async def test_chat_update_keeps_edited_complaint_fields():
    from campus247.models.intake_fields import missing_fields_for

    agent, _ = _agent_with_extraction(
        _extract(provided_fields=["description"], description="Điểm trên cổng khác với bài thi")
    )
    fields = Fields(
        complaint_subtype="grade_appeal",
        course="Cơ sở dữ liệu",
        description="Sinh viên đã sửa mô tả này",
    )
    preview = make_preview(
        service_type="academic_complaint",
        fields=fields,
        missing_fields=missing_fields_for("academic_complaint", fields),
        can_submit=not missing_fields_for("academic_complaint", fields),
    )
    result = await agent.run_intake(make_context("Bổ sung: điểm trên cổng khác với bài thi", preview=preview))
    assert result.intake.fields.course == "Cơ sở dữ liệu"
    assert result.intake.fields.description == "Điểm trên cổng khác với bài thi"
    assert result.intake.fields.complaint_subtype == "grade_appeal"


@pytest.mark.asyncio
async def test_switch_to_certificate_does_not_copy_complaint_fields():
    agent, _ = _agent_with_extraction(_extract(provided_fields=[]))
    fields = Fields(
        complaint_subtype="grade_appeal",
        course="Toán",
        description="Điểm chưa đúng",
    )
    preview = make_preview(service_type="academic_complaint", fields=fields)
    result = await agent.run_intake(
        make_context("Tôi muốn đổi sang xin giấy xác nhận sinh viên.", preview=preview)
    )
    assert result.route == "L2"
    assert result.intake.service_type == "student_certificate"
    assert result.handover is None
    assert result.intake.fields.course is None
    assert result.intake.fields.complaint_subtype is None
    assert result.intake.fields.purpose is None
