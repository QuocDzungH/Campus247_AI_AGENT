from __future__ import annotations

import re
import time
from datetime import date, timedelta
from typing import Any

from campus247.agents.llm_invoke import (
    OFFICER_BUDGET_SECONDS,
    PROVIDER_CALL_TIMEOUT_SECONDS,
    ainvoke_structured,
    remaining_timeout,
)
from campus247.agents.prompts.officer import TRIAGE_SYSTEM
from campus247.agents.provenance import source_id_for_field, student_messages
from campus247.agents.snapshot_text import format_officer_context
from campus247.agents.state import OfficerState, TriageOutput
from campus247.models.contracts_v1 import ChecklistItem, Priority, TicketSnapshot

_CLAUSE_SPLIT = re.compile(
    r"[.\n;!?]+|\s+và\s+|\s+nhưng\s+|\s+mà\s+|,\s*",
    re.IGNORECASE,
)
_CONCRETE_TIME = re.compile(
    r"(hôm nay|trong ngày|ngày mai|trước 24\s*h|dưới 24\s*h|còn \d+\s*giờ|"
    r"gấp nộp|nộp gấp|nộp hôm nay|hạn nộp hôm nay|deadline hôm nay|"
    r"trước \d{1,2}\s*h(?:\d{0,2})?)",
    re.IGNORECASE,
)
_TIME_DENIAL = re.compile(
    r"không (cần|phải)(?:\s+\S+){0,6}?\s+(nộp|gửi|giấy)|"
    r"(không có|chưa có)\s+(deadline|hạn nộp|hạn cụ thể|mốc thời gian)|"
    r"chưa đến hạn|chưa có hạn|không gấp|không khẩn|"
    r"không (đặt|nêu|đề cập)\s*(deadline|hạn nộp|mốc)?",
    re.IGNORECASE,
)
_ISO_DATE = re.compile(r"(?<!\d)(\d{4})-(\d{1,2})-(\d{1,2})(?!\d)")
_DMY_DATE = re.compile(r"(?<!\d)(\d{1,2})([/-])(\d{1,2})\2(\d{4})(?!\d)")
_DM_DATE = re.compile(r"(?<!\d)(\d{1,2})([/-])(\d{1,2})(?!(?:[/-]\d{4})|\d)")
_DEADLINE_CUE = re.compile(
    r"hạn\s*nộp|hạn\s*chót|deadline|trước\s*ngày|cần\s*giấy\s*trước|"
    r"cần\s*nộp\s*trước|nộp\s*trước|giấy\s*trước",
    re.IGNORECASE,
)
_DEADLINE_CUE_IMMEDIATE = re.compile(
    r"(?:trước(?:\s+ngày)?|deadline|hạn(?:\s*nộp)?(?:\s+là)?)\s*$",
    re.IGNORECASE,
)
_IMPACT = re.compile(
    r"((nguy cơ|có thể|sắp|bị)\s+)?mất học bổng|cắt học bổng|mất suất học bổng|"
    r"(lỡ|trễ|hết)\s*hạn visa|visa sắp hết hạn|hạn visa.{0,16}(hôm nay|trong ngày|ngày mai)|"
    r"(bị|buộc|có thể bị|nguy cơ)\s+thôi học",
    re.IGNORECASE,
)
_IMPACT_DENIAL = re.compile(
    r"không (bị |phải )?(ảnh hưởng|liên quan|mất|cắt)(?:\s+\S+){0,6}?\s+(học bổng|visa|thôi học)|"
    r"(học bổng|visa|thôi học)(?:\s+\S+){0,6}?\s+không (bị |phải )?(ảnh hưởng|liên quan|mất)|"
    r"không (bị |phải )?thôi học",
    re.IGNORECASE,
)

CHECKLISTS: dict[str, list[tuple[str, str]]] = {
    "student_certificate": [
        ("cert_check_enrollment", "Kiểm tra tình trạng học tập trên hồ sơ được phép xem"),
        ("cert_check_purpose", "Đối chiếu mục đích và nơi nhận do sinh viên khai"),
        ("cert_check_receive_method", "Xác nhận hình thức nhận giấy"),
        ("cert_review_draft", "Soát draft phản hồi trước khi gửi"),
    ],
    "academic_complaint": [
        ("complaint_scope", "Xác định phạm vi khiếu nại và môn/học phần liên quan"),
        ("complaint_evidence", "Kiểm tra minh chứng sinh viên đã cung cấp"),
        ("complaint_policy", "Đối chiếu quy chế với nguồn đã duyệt"),
        ("complaint_no_promise", "Tiếp nhận hồ sơ, không hứa kết quả phúc khảo"),
    ],
    "student_support": [
        ("support_privacy", "Giới hạn phạm vi người được xem hồ sơ"),
        ("support_referral", "Chuyển đúng bộ phận hỗ trợ sinh viên"),
        ("support_no_diagnosis", "Không chẩn đoán và không tư vấn lâm sàng"),
        ("support_followup", "Theo dõi tiếp nhận an toàn"),
    ],
}


def checklist_for(snapshot: TicketSnapshot) -> list[ChecklistItem]:
    rows = CHECKLISTS.get(snapshot.ticket.service_type, CHECKLISTS["student_certificate"])
    return [ChecklistItem(id=item_id, label=label, checked=False) for item_id, label in rows]


def _mask_denials(clause: str, denial: re.Pattern[str]) -> str:
    return denial.sub(lambda match: " " * (match.end() - match.start()), clause)


def _student_priority_text(snapshot: TicketSnapshot) -> str:
    blobs = [message.content for message in student_messages(snapshot)]
    fields = snapshot.intake_packet.fields if snapshot.intake_packet is not None else snapshot.ticket.request_data
    if fields is not None:
        for key, value in fields.model_dump().items():
            if value and source_id_for_field(snapshot, key, str(value)):
                blobs.append(str(value))
    return "\n".join(blobs)


def _safe_date(year: int, month: int, day: int) -> date | None:
    try:
        return date(year, month, day)
    except ValueError:
        return None


def _in_deadline_context(clause: str, start: int) -> bool:
    prefix = clause[:start]
    return bool(_DEADLINE_CUE.search(prefix) or _DEADLINE_CUE_IMMEDIATE.search(prefix))


def _resolve_day_month(day: int, month: int, reference_date: date) -> date | None:
    tomorrow = reference_date + timedelta(days=1)
    if (day, month) == (reference_date.day, reference_date.month):
        return reference_date
    if (day, month) == (tomorrow.day, tomorrow.month):
        return tomorrow
    this_year = _safe_date(reference_date.year, month, day)
    if this_year is not None:
        return this_year
    return _safe_date(reference_date.year + 1, month, day)


def _dates_in_clause(clause: str, reference_date: date) -> list[date]:
    occupied: list[tuple[int, int]] = []
    found: list[date] = []

    def take(start: int, end: int, parsed: date | None) -> None:
        if parsed is None or any(start < right and end > left for left, right in occupied):
            return
        if not _in_deadline_context(clause, start):
            return
        occupied.append((start, end))
        if parsed not in found:
            found.append(parsed)

    for match in _ISO_DATE.finditer(clause):
        year, month, day = (int(match.group(1)), int(match.group(2)), int(match.group(3)))
        take(match.start(), match.end(), _safe_date(year, month, day))
    for match in _DMY_DATE.finditer(clause):
        day, month, year = (int(match.group(1)), int(match.group(3)), int(match.group(4)))
        take(match.start(), match.end(), _safe_date(year, month, day))
    for match in _DM_DATE.finditer(clause):
        take(match.start(), match.end(), _resolve_day_month(int(match.group(1)), int(match.group(3)), reference_date))
    return found


def extract_absolute_deadlines(text: str, reference_date: date) -> list[date]:
    found: list[date] = []
    for window in _CLAUSE_SPLIT.split(text):
        chunk = window.strip()
        if not chunk or _TIME_DENIAL.search(chunk):
            continue
        for parsed in _dates_in_clause(chunk, reference_date):
            if parsed not in found:
                found.append(parsed)
    return found


def absolute_deadline_reason(snapshot: TicketSnapshot) -> str | None:
    reference = snapshot.ticket.updated_at.date()
    urgent_days = {reference, reference + timedelta(days=1)}
    hits = [
        item
        for item in extract_absolute_deadlines(_student_priority_text(snapshot), reference)
        if item in urgent_days
    ]
    if not hits:
        return None
    stamp = min(hits).strftime("%d/%m/%Y")
    return f"Sinh viên khai deadline {stamp} rơi vào hôm nay hoặc ngày kế tiếp."


def deadline_is_urgent(snapshot: TicketSnapshot) -> str | None:
    text = _student_priority_text(snapshot)
    impact = False
    for window in _CLAUSE_SPLIT.split(text):
        chunk = window.strip()
        if not chunk:
            continue
        if not _TIME_DENIAL.search(chunk) and _CONCRETE_TIME.search(chunk):
            return "Có mốc thời gian gấp hoặc hạn nộp trong ngày trên hồ sơ."
        if _IMPACT.search(_mask_denials(chunk, _IMPACT_DENIAL)):
            impact = True
    if impact:
        return "Có tín hiệu nguy cơ mất học bổng, lỡ hạn visa hoặc thôi học trên hồ sơ."
    return None


def apply_priority_floor(snapshot: TicketSnapshot, suggested: Priority, reasons: list[str]) -> tuple[Priority, list[str]]:
    reasons = [item.strip() for item in reasons if item and item.strip()]
    if snapshot.ticket.priority == "high":
        suggested = "high"
        if not reasons:
            reasons = list(snapshot.ticket.priority_reasons) or ["Ticket đã được gắn ưu tiên cao."]
    if snapshot.ticket.service_type == "student_support" or (
        snapshot.handover_packet and snapshot.handover_packet.risk_type == "wellbeing"
    ):
        suggested = "high"
        marker = "Ca hỗ trợ sinh viên giữ ưu tiên cao."
        if marker not in reasons:
            reasons.append(marker)
    urgent = deadline_is_urgent(snapshot)
    if urgent:
        suggested = "high"
        if urgent not in reasons:
            reasons.append(urgent)
    absolute = absolute_deadline_reason(snapshot)
    if absolute:
        suggested = "high"
        if absolute not in reasons:
            reasons.append(absolute)
    if suggested == "high" and not reasons:
        reasons = ["Cần ưu tiên xử lý dựa trên hồ sơ hiện có."]
    return suggested, reasons


def make_triage_node(model: Any, *, provider_timeout: float = PROVIDER_CALL_TIMEOUT_SECONDS):
    async def triage_node(state: OfficerState) -> dict:
        snapshot = state["snapshot"]
        started_at = float(state.get("started_at") or time.monotonic())
        timeout = remaining_timeout(started_at, OFFICER_BUDGET_SECONDS, provider_timeout)
        messages = [
            {"role": "system", "content": TRIAGE_SYSTEM},
            {"role": "user", "content": format_officer_context(snapshot)},
        ]
        triage = await ainvoke_structured(
            model,
            TriageOutput,
            messages,
            stage="brief",
            request_id=snapshot.request_id,
            timeout=timeout,
            retry_transient=False,
        )
        if not isinstance(triage, TriageOutput):
            triage = TriageOutput.model_validate(triage)
        suggested, reasons = apply_priority_floor(snapshot, triage.suggested_priority, list(triage.priority_reasons))
        return {
            "checklist": checklist_for(snapshot),
            "suggested_priority": suggested,
            "priority_reasons": reasons,
        }

    return triage_node
