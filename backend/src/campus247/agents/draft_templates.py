"""Fixed officer reception templates. Code owns these strings; the model does not."""

from __future__ import annotations

from campus247.models.contracts_v1 import TicketSnapshot

SAFE_TEMPLATE_VERSION = "officer-safe-template-v1"

_TEMPLATES = {
    "student_certificate": (
        "Bộ phận phụ trách sẽ kiểm tra yêu cầu cấp giấy xác nhận sinh viên của bạn và phản hồi sau khi rà soát hồ sơ."
    ),
    "academic_complaint": (
        "Bộ phận phụ trách sẽ kiểm tra thông tin khiếu nại đã ghi nhận. Kết quả xử lý sẽ do cán bộ thông báo sau khi rà soát."
    ),
    "student_support": (
        "Thông tin đã được ghi nhận để bộ phận phụ trách tiếp nhận. Cán bộ sẽ liên hệ sau khi kiểm tra hồ sơ."
    ),
}

_GROUNDED_FALLBACK = {
    "student_certificate": (
        "Bộ phận phụ trách sẽ đối chiếu yêu cầu cấp giấy xác nhận sinh viên với nguồn quy chế đã duyệt trong hồ sơ và phản hồi sau khi rà soát."
    ),
    "academic_complaint": (
        "Bộ phận phụ trách sẽ đối chiếu thông tin khiếu nại với nguồn quy chế đã duyệt trong hồ sơ. Kết quả xử lý sẽ do cán bộ thông báo sau khi rà soát."
    ),
    "student_support": (
        "Thông tin đã được ghi nhận. Cán bộ sẽ đối chiếu hồ sơ với nguồn đã duyệt trước khi liên hệ."
    ),
}


def template_draft(snapshot: TicketSnapshot, *, grounded: bool = False) -> str:
    table = _GROUNDED_FALLBACK if grounded else _TEMPLATES
    return table.get(snapshot.ticket.service_type, table["student_certificate"])


def safe_template(service_type: str) -> str:
    return _TEMPLATES.get(service_type, _TEMPLATES["student_certificate"])
