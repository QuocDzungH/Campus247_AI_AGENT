"""Approved process catalog. Criteria and templates come from here, not from screenshots."""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class ProcessSpec:
    service_type: str
    label: str
    process_version: str
    issues_document: bool
    template_id: str | None
    template_version: str | None
    template_status: str  # approved | unavailable
    validity_days: int | None
    requires_academic_status: bool
    requires_financial_clearance: bool
    required_criteria: tuple[str, ...]
    issue_required_criteria: tuple[str, ...]
    required_checklist: tuple[dict[str, str], ...] = field(default_factory=tuple)


PROCESSES: dict[str, ProcessSpec] = {
    "student_certificate": ProcessSpec(
        service_type="student_certificate",
        label="Giấy xác nhận sinh viên",
        process_version="cert-process-v1",
        issues_document=True,
        template_id="student_certificate_vn",
        template_version="v1",
        template_status="approved",
        validity_days=None,
        requires_academic_status=True,
        requires_financial_clearance=False,
        required_criteria=("identity_match", "form_completeness"),
        issue_required_criteria=("identity_match", "form_completeness", "academic_status"),
        required_checklist=(
            {"id": "chk_identity", "label": "Đối chiếu họ tên / MSSV với hồ sơ nguồn"},
            {"id": "chk_form", "label": "Kiểm tra mục đích, nơi nhận và cách nhận"},
            {"id": "chk_evidence", "label": "Xem kết quả đối soát và ghi nhận bằng chứng"},
        ),
    ),
    "academic_complaint": ProcessSpec(
        service_type="academic_complaint",
        label="Khiếu nại",
        process_version="complaint-process-v1",
        issues_document=False,
        template_id=None,
        template_version=None,
        template_status="unavailable",
        validity_days=None,
        requires_academic_status=False,
        requires_financial_clearance=False,
        required_criteria=("identity_match", "form_completeness"),
        issue_required_criteria=(),
        required_checklist=(
            {"id": "chk_context", "label": "Đọc hội thoại, bản khai và lý do bàn giao"},
            {"id": "chk_identity", "label": "Xác nhận đúng sinh viên gửi yêu cầu"},
        ),
    ),
    "student_support": ProcessSpec(
        service_type="student_support",
        label="Hỗ trợ sinh viên",
        process_version="support-process-v1",
        issues_document=False,
        template_id=None,
        template_version=None,
        template_status="unavailable",
        validity_days=None,
        requires_academic_status=False,
        requires_financial_clearance=False,
        required_criteria=("identity_match",),
        issue_required_criteria=(),
        required_checklist=(
            {"id": "chk_context", "label": "Đọc ngữ cảnh và mức độ nhạy cảm trước khi phản hồi"},
        ),
    ),
}


def get_process(service_type: str) -> ProcessSpec:
    spec = PROCESSES.get(service_type)
    if spec is not None:
        return spec
    return ProcessSpec(
        service_type=service_type,
        label=service_type,
        process_version="unknown-v0",
        issues_document=False,
        template_id=None,
        template_version=None,
        template_status="unavailable",
        validity_days=None,
        requires_academic_status=False,
        requires_financial_clearance=False,
        required_criteria=("identity_match",),
        issue_required_criteria=(),
        required_checklist=(
            {"id": "chk_manual", "label": "Đối chiếu bản khai theo nghiệp vụ của loại hồ sơ này"},
        ),
    )


def process_info(service_type: str) -> dict:
    spec = get_process(service_type)
    return {
        "service_type": spec.service_type,
        "label": spec.label,
        "process_version": spec.process_version,
        "issues_document": spec.issues_document,
        "template_id": spec.template_id,
        "template_version": spec.template_version,
        "template_status": spec.template_status,
        "validity_days": spec.validity_days,
        "requires_academic_status": spec.requires_academic_status,
        "requires_financial_clearance": spec.requires_financial_clearance,
        "required_criteria": list(spec.required_criteria),
        "issue_required_criteria": list(spec.issue_required_criteria),
        "planned_checklist": [{"id": item["id"], "label": item["label"], "required": True} for item in spec.required_checklist],
    }
