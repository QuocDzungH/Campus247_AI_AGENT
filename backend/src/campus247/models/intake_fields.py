"""Shared intake field names and missing-field rules for certificate and complaint."""

from __future__ import annotations

from typing import Any, Iterable, Literal

IntakeService = Literal["student_certificate", "academic_complaint"]
ComplaintSubtype = Literal["grade_appeal", "other"]

CERTIFICATE_FIELDS = ("purpose", "destination_org", "receive_method")
COMPLAINT_FIELDS = (
    "complaint_subtype",
    "course",
    "course_code",
    "assessment",
    "description",
    "requested_outcome",
    "evidence",
)
ALL_INTAKE_FIELDS = CERTIFICATE_FIELDS + COMPLAINT_FIELDS

CERTIFICATE_REQUIRED = CERTIFICATE_FIELDS
COMPLAINT_ALWAYS_REQUIRED = ("complaint_subtype",)
GRADE_APPEAL_REQUIRED = ("complaint_subtype", "course", "description")
OTHER_COMPLAINT_REQUIRED = ("complaint_subtype", "description")

FIELD_QUESTIONS: dict[str, str] = {
    "purpose": "mục đích sử dụng giấy",
    "destination_org": "nơi nộp giấy",
    "receive_method": "hình thức nhận (bản điện tử PDF hoặc bản giấy đóng dấu)",
    "complaint_subtype": "bạn muốn khiếu nại về vấn đề gì",
    "course": "môn học / học phần đang khiếu nại",
    "course_code": "mã học phần nếu bạn có",
    "assessment": "loại điểm đang khiếu nại",
    "description": "nội dung khiếu nại",
    "requested_outcome": "kết quả bạn mong muốn",
    "evidence": "minh chứng nếu bạn có",
}

SERVICE_LABELS: dict[str, str] = {
    "student_certificate": "Xin giấy xác nhận sinh viên",
    "academic_complaint": "Khiếu nại",
}

SUBTYPE_LABELS: dict[str, str] = {
    "grade_appeal": "Điểm học phần",
    "other": "Nội dung khác",
}

RECEIVING_UNIT = "Phòng Đào tạo / học vụ"


def _value(fields: Any, name: str) -> Any:
    if hasattr(fields, name):
        return getattr(fields, name)
    if isinstance(fields, dict):
        return fields.get(name)
    return None


def is_filled(value: Any) -> bool:
    if value is None:
        return False
    if isinstance(value, str):
        return bool(value.strip())
    return True


def required_fields(service_type: str, fields: Any) -> tuple[str, ...]:
    if service_type == "student_certificate":
        return CERTIFICATE_REQUIRED
    subtype = _value(fields, "complaint_subtype")
    if subtype == "grade_appeal":
        return GRADE_APPEAL_REQUIRED
    if subtype == "other":
        return OTHER_COMPLAINT_REQUIRED
    return COMPLAINT_ALWAYS_REQUIRED


def missing_fields_for(service_type: str, fields: Any) -> list[str]:
    return [name for name in required_fields(service_type, fields) if not is_filled(_value(fields, name))]


def relevant_field_names(service_type: str) -> tuple[str, ...]:
    if service_type == "student_certificate":
        return CERTIFICATE_FIELDS
    return COMPLAINT_FIELDS


def empty_fields_dict() -> dict[str, Any]:
    payload: dict[str, Any] = {name: None for name in ALL_INTAKE_FIELDS}
    payload["extras"] = {}
    return payload


def ticket_summary(service_type: str, fields: Any) -> str:
    if service_type == "student_certificate":
        purpose = _value(fields, "purpose") or "yêu cầu học vụ"
        return f"Xin giấy xác nhận sinh viên để {purpose}"
    subtype = _value(fields, "complaint_subtype")
    course = _value(fields, "course")
    if subtype == "grade_appeal":
        return f"Khiếu nại điểm học phần{f' · {course}' if course else ''}"
    description = _value(fields, "description")
    if description:
        text = str(description).strip()
        return text[:180] + ("…" if len(text) > 180 else "")
    return "Khiếu nại học vụ"


def cleared_for_service(service_type: str, fields: Any) -> dict[str, Any]:
    """Keep only fields that belong to the selected service type."""
    payload = empty_fields_dict()
    keep = set(relevant_field_names(service_type)) | {"extras"}
    source = fields.model_dump() if hasattr(fields, "model_dump") else dict(fields or {})
    for key, value in source.items():
        if key in keep:
            payload[key] = value
    return payload
