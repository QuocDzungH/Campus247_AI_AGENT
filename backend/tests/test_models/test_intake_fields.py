from campus247.models.contracts_v1 import Fields, Intake
from campus247.models.intake_fields import missing_fields_for, ticket_summary
from campus247.services.serializers import intake_from_stored


def test_certificate_missing_fields_unchanged():
    fields = Fields(purpose="Vay vốn ngân hàng", destination_org=None, receive_method="digital_pdf")
    assert missing_fields_for("student_certificate", fields) == ["destination_org"]


def test_vague_complaint_only_requires_subtype():
    assert missing_fields_for("academic_complaint", Fields()) == ["complaint_subtype"]


def test_grade_appeal_requires_course_and_description():
    fields = Fields(complaint_subtype="grade_appeal", course="CSDL")
    assert missing_fields_for("academic_complaint", fields) == ["description"]


def test_other_complaint_does_not_require_course():
    fields = Fields(complaint_subtype="other", description="Phản ánh lịch thi")
    assert missing_fields_for("academic_complaint", fields) == []


def test_intake_from_stored_ignores_unused_null_keys():
    payload = Fields(
        complaint_subtype="other",
        description="Cơ sở vật chất phòng 205 bị hỏng màn hình máy chiếu",
        requested_outcome="thay sớm",
    ).model_dump(mode="json")
    try:
        Intake.model_validate(
            {
                "service_type": "academic_complaint",
                "fields": payload,
                "missing_fields": [key for key, value in payload.items() if value is None],
                "invalid_fields": [],
            }
        )
        raise AssertionError("all-null keys must not be treated as missing_fields")
    except ValueError:
        pass
    intake = intake_from_stored("academic_complaint", payload)
    assert intake.missing_fields == []
    assert intake.fields.description.startswith("Cơ sở vật chất")


def test_ticket_summary_keeps_complaint_group():
    grade = Fields(complaint_subtype="grade_appeal", course="Cơ sở dữ liệu")
    assert ticket_summary("academic_complaint", grade) == "Khiếu nại điểm học phần · Cơ sở dữ liệu"
    assert ticket_summary("student_certificate", Fields(purpose="vay vốn")) == "Xin giấy xác nhận sinh viên để vay vốn"
