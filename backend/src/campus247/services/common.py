from __future__ import annotations

import hashlib
import json
import secrets
import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session

from campus247.db.engine import dialect_name
from campus247.db.models import Message, TicketCodeSequence
from campus247.models.contracts_v1 import ErrorDetails
from campus247.services.errors import ApiError

SERVICE_TEAM = {
    "student_certificate": "academic",
    "academic_complaint": "academic",
    "student_support": "student_support",
}
RISK_ROUTING = {
    "academic_complaint": ("complaint", "academic_complaint", "academic", "demo_academic"),
    "unauthorized_action": ("complaint", "academic_complaint", "academic", "demo_academic"),
    "wellbeing": ("complaint", "student_support", "student_support", "demo_support"),
}

MSG_HANDOVER = "Đã chuyển yêu cầu tới cán bộ phụ trách."
MSG_FORWARDED = "Thông tin đã được lưu để cán bộ tiếp nhận."
MSG_SUPPLEMENT = "Đã ghi nhận thông tin bổ sung."
MSG_L1_EMPTY = "Kho tài liệu hiện tại chưa đủ căn cứ để trả lời câu hỏi này."
MSG_RECEIVED_CERT = "Đã ghi nhận yêu cầu cấp giấy xác nhận."


def utcnow() -> datetime:
    return datetime.now(UTC)


def ensure_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex}"


def new_token() -> str:
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def hash_payload(payload: Any) -> str:
    canonical = json.dumps(payload, sort_keys=True, ensure_ascii=False, default=str, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def parse_page(page: int | None, page_size: int | None) -> tuple[int, int]:
    resolved_page = page or 1
    resolved_size = page_size or 20
    if resolved_page < 1 or resolved_size < 1 or resolved_size > 100:
        raise ApiError(422, "VALIDATION_ERROR", "Tham số phân trang không hợp lệ.")
    return resolved_page, resolved_size


def paginate(items: list, total: int, page: int, page_size: int):
    from campus247.models.contracts_v1 import Page

    return Page(items=items, total=total, page=page, page_size=page_size)


def lock_select(session: Session, stmt: Select) -> Select:
    if dialect_name(session) == "postgresql":
        return stmt.with_for_update()
    return stmt


def next_message_seq(session: Session, conversation_id: str) -> int:
    current = session.execute(select(func.coalesce(func.max(Message.seq), 0)).where(Message.conversation_id == conversation_id)).scalar_one()
    return int(current) + 1


def next_ticket_code(session: Session, year: int) -> str:
    stmt = lock_select(session, select(TicketCodeSequence).where(TicketCodeSequence.year == year))
    seq = session.execute(stmt).scalar_one_or_none()
    if seq is None:
        seq = TicketCodeSequence(year=year, last_value=0)
        session.add(seq)
        session.flush()
        seq = session.execute(lock_select(session, select(TicketCodeSequence).where(TicketCodeSequence.year == year))).scalar_one()
    seq.last_value += 1
    return f"TKT-{year}-{seq.last_value:04d}"


def stale_revision(current: int) -> ApiError:
    return ApiError(
        409,
        "STALE_REVISION",
        "Hồ sơ đã thay đổi. Vui lòng tải lại trước khi xác nhận.",
        details=ErrorDetails(current_revision=current),
    )
