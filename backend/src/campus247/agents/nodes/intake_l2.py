from __future__ import annotations

import re
import time
from typing import Any

from pydantic import ValidationError

from campus247.agents.errors import module_error
from campus247.agents.llm_invoke import (
    INTAKE_BUDGET_SECONDS,
    PROVIDER_CALL_TIMEOUT_SECONDS,
    ainvoke_structured,
    remaining_timeout,
)
from campus247.agents.prompts.intake import L2_COMPLAINT_EXTRACT_SYSTEM, L2_EXTRACT_SYSTEM
from campus247.agents.state import FieldExtraction, IntakeState, RouteDecision
from campus247.models.contracts_v1 import FieldIssue, Fields, Intake, IntakeContext, IntakeResult
from campus247.models.intake_fields import (
    ALL_INTAKE_FIELDS,
    FIELD_QUESTIONS,
    missing_fields_for,
    relevant_field_names,
)

VAGUE_PURPOSE = {"gấp", "gap", "nhanh", "asap", "gấp luôn", "gấp gáp"}

MSG_L2_REVIEW = "Bạn hãy kiểm tra thông tin trước khi gửi."
MSG_L2_SELF_SUBMIT = (
    "Bạn sẽ phải tự nhấn Nộp yêu cầu (Submit 1) sau khi xác nhận thông tin đã đúng. "
    "Trợ lý không gửi hộ."
)
MSG_COMPLAINT_ASK_TOPIC = "Bạn muốn khiếu nại về vấn đề gì?"
MSG_SWITCHED_COMPLAINT = (
    "Mình đã chuyển sang form khiếu nại. Thông tin giấy xác nhận được giữ riêng, không mang sang đơn này."
)
MSG_SWITCHED_CERTIFICATE = (
    "Mình đã chuyển sang form xin giấy xác nhận. Thông tin khiếu nại được giữ riêng, không mang sang đơn này."
)

_SEND_ON_BEHALF_MARKERS = (
    "gửi giúp",
    "gửi hộ",
    "gửi dùm",
    "nộp giúp",
    "nộp hộ",
    "nộp dùm",
    "tự gửi",
    "tự nộp",
    "bạn gửi",
    "gửi luôn",
    "hãy gửi",
    "gửi đi",
    "giúp tôi gửi",
    "giúp mình gửi",
    "submit giúp",
    "submit hộ",
)

_COURSE = re.compile(
    r"môn\s+(.{1,80}?)(?:\s+của tôi|\s+vì|\s+do|,|\.|$)",
    re.IGNORECASE,
)
_COURSE_CODE = re.compile(r"\b([A-Z]{2,4}\d{3,4}[A-Z]?)\b")
_ASSESSMENT = re.compile(
    r"(điểm thi cuối kỳ|cuối kỳ|giữa kỳ|điểm tổng kết|tổng kết học phần)",
    re.IGNORECASE,
)


def asks_to_submit_on_behalf(message: str | None) -> bool:
    if not message:
        return False
    text = " ".join(message.casefold().split())
    return any(marker in text for marker in _SEND_ON_BEHALF_MARKERS)


def _usable(field: str, value: str | None) -> tuple[bool, str | None]:
    if value is None:
        return False, None
    stripped = value.strip()
    if not stripped:
        return False, f"Trường {field} đang trống."
    if field == "purpose":
        if stripped.lower() in VAGUE_PURPOSE or len(stripped) < 5:
            return False, "Mục đích chưa đủ rõ. Bạn cho biết giấy này dùng để làm việc gì."
        return True, stripped
    if field == "destination_org":
        return True, stripped[:300]
    if field == "receive_method":
        if stripped in {"digital_pdf", "paper_stamped"}:
            return True, stripped
        return False, "Bạn chọn bản điện tử PDF hoặc bản giấy đóng dấu."
    if field == "complaint_subtype":
        if stripped in {"grade_appeal", "other"}:
            return True, stripped
        return False, "Chọn khiếu nại điểm học phần hoặc nội dung khiếu nại khác."
    if field == "course":
        return True, stripped[:200]
    if field == "course_code":
        return True, stripped[:40]
    if field == "assessment":
        return True, stripped[:100]
    if field == "description":
        return True, stripped[:4000]
    if field == "requested_outcome":
        return True, stripped[:2000]
    if field == "evidence":
        return True, stripped[:2000]
    return True, stripped


def merge_intake_fields(
    existing: Fields | None,
    extraction: FieldExtraction,
    service_type: str,
) -> tuple[Fields, list[FieldIssue]]:
    current = existing.model_dump() if existing is not None else {
        name: None for name in ALL_INTAKE_FIELDS
    }
    current.setdefault("extras", {})
    invalid = list(extraction.invalid_fields)
    invalid_names = {item.field for item in invalid}
    provided = list(dict.fromkeys(extraction.provided_fields))
    allowed = set(relevant_field_names(service_type))

    for field in provided:
        if field not in allowed:
            continue
        raw = getattr(extraction, field, None)
        ok, cleaned = _usable(field, raw if isinstance(raw, str) or raw is None else str(raw))
        if field in invalid_names:
            continue
        if ok:
            current[field] = cleaned
        else:
            invalid.append(FieldIssue(field=field, reason=cleaned or f"Trường {field} không hợp lệ."))

    try:
        fields = Fields.model_validate(current)
    except ValidationError:
        safe = {name: current.get(name) for name in ALL_INTAKE_FIELDS}
        if safe.get("purpose") and len(str(safe["purpose"])) < 5:
            safe["purpose"] = None
        if safe.get("receive_method") not in {"digital_pdf", "paper_stamped"}:
            safe["receive_method"] = None
        if safe.get("complaint_subtype") not in {"grade_appeal", "other"}:
            safe["complaint_subtype"] = None
        safe["extras"] = current.get("extras") or {}
        fields = Fields.model_validate(safe)
        for key, value in current.items():
            if key == "extras":
                continue
            if value is not None and getattr(fields, key, None) is None and key not in {item.field for item in invalid}:
                invalid.append(FieldIssue(field=key, reason="Giá trị chưa đủ điều kiện để lưu."))
    return fields, invalid


def merge_certificate_fields(
    existing: Fields | None,
    extraction: FieldExtraction,
) -> tuple[Fields, list[FieldIssue]]:
    return merge_intake_fields(existing, extraction, "student_certificate")


def complaint_hints(text: str) -> FieldExtraction:
    lowered = text.casefold()
    provided: list[str] = []
    subtype = None
    if any(token in lowered for token in ("điểm", "phúc khảo", "học phần")):
        subtype = "grade_appeal"
        provided.append("complaint_subtype")
    course = None
    match = _COURSE.search(text)
    if match:
        course = match.group(1).strip(" .,:;")
        if course:
            provided.append("course")
    code = None
    code_match = _COURSE_CODE.search(text)
    if code_match:
        code = code_match.group(1)
        provided.append("course_code")
    assessment = None
    assess_match = _ASSESSMENT.search(text)
    if assess_match:
        token = assess_match.group(1).casefold()
        if "giữa" in token:
            assessment = "Điểm giữa kỳ"
        elif "tổng kết" in token:
            assessment = "Điểm tổng kết học phần"
        else:
            assessment = "Điểm thi cuối kỳ"
        provided.append("assessment")
    description = None
    reason = re.search(r"(?:vì|do)\s+(.{8,400})", text, re.IGNORECASE)
    if reason:
        description = reason.group(1).strip(" .")
        provided.append("description")
    return FieldExtraction(
        provided_fields=list(dict.fromkeys(provided)),
        complaint_subtype=subtype,
        course=course,
        course_code=code,
        assessment=assessment,
        description=description,
    )


def _merge_hints(extraction: FieldExtraction, hints: FieldExtraction) -> FieldExtraction:
    provided = list(dict.fromkeys([*extraction.provided_fields, *hints.provided_fields]))
    data = extraction.model_dump()
    for field in hints.provided_fields:
        if not data.get(field):
            data[field] = getattr(hints, field)
    data["provided_fields"] = provided
    return FieldExtraction.model_validate(data)


def build_l2_reply(
    missing: list[str],
    invalid: list[FieldIssue],
    *,
    preview_ready: bool,
    user_message: str | None = None,
    service_type: str = "student_certificate",
    switched: bool = False,
) -> str:
    prefix = ""
    if switched:
        prefix = (MSG_SWITCHED_COMPLAINT if service_type == "academic_complaint" else MSG_SWITCHED_CERTIFICATE) + " "
    if preview_ready:
        if asks_to_submit_on_behalf(user_message):
            return prefix + MSG_L2_SELF_SUBMIT
        return prefix + MSG_L2_REVIEW
    needed: list[str] = []
    for item in invalid:
        label = FIELD_QUESTIONS.get(item.field, item.field)
        if label not in needed:
            needed.append(label)
    for field in missing:
        label = FIELD_QUESTIONS.get(field, field)
        if label not in needed:
            needed.append(label)
    if not needed:
        needed = [FIELD_QUESTIONS[name] for name in relevant_field_names(service_type)[:3]]
    if service_type == "academic_complaint" and missing == ["complaint_subtype"] and not invalid:
        return prefix + MSG_COMPLAINT_ASK_TOPIC
    if len(needed) == 1:
        return prefix + f"Bạn cho biết {needed[0]}."
    if len(needed) == 2:
        return prefix + f"Bạn cho biết {needed[0]} và {needed[1]}."
    return prefix + f"Bạn cho biết {needed[0]}, {needed[1]} và {needed[2]}."


def make_l2_node(model: Any, *, provider_timeout: float = PROVIDER_CALL_TIMEOUT_SECONDS):
    async def l2_node(state: IntakeState) -> dict:
        context = state["context"]
        if not isinstance(context, IntakeContext):
            context = IntakeContext.model_validate(context)
        decision = state.get("decision")
        if decision is not None and not isinstance(decision, RouteDecision):
            decision = RouteDecision.model_validate(decision)
        service_type = "student_certificate"
        if decision is not None and decision.intent in {"student_certificate", "academic_complaint"}:
            service_type = decision.intent
        elif context.preview is not None and context.preview.service_type in {
            "student_certificate",
            "academic_complaint",
        }:
            service_type = context.preview.service_type

        switched = bool(
            context.preview is not None and context.preview.service_type != service_type
        )
        existing = None
        if context.preview is not None and context.preview.service_type == service_type:
            existing = context.preview.fields

        extract_system = L2_COMPLAINT_EXTRACT_SYSTEM if service_type == "academic_complaint" else L2_EXTRACT_SYSTEM
        messages = [
            {"role": "system", "content": extract_system},
            {
                "role": "user",
                "content": (
                    f"Tin hiện tại: {context.message.content}\n"
                    f"Loại đơn: {service_type}\n"
                    f"Preview fields: "
                    f"{existing.model_dump_json() if existing is not None else 'null'}"
                ),
            },
        ]
        started_at = float(state.get("started_at") or time.monotonic())
        timeout = remaining_timeout(started_at, INTAKE_BUDGET_SECONDS, provider_timeout)
        extraction = await ainvoke_structured(
            model,
            FieldExtraction,
            messages,
            stage="intake",
            request_id=context.request_id,
            timeout=timeout,
            retry_transient=True,
        )
        if not isinstance(extraction, FieldExtraction):
            try:
                extraction = FieldExtraction.model_validate(extraction)
            except ValidationError as exc:
                raise module_error("OUTPUT_SCHEMA_INVALID", stage="intake", request_id=context.request_id) from exc

        if service_type == "academic_complaint":
            extraction = _merge_hints(extraction, complaint_hints(context.message.content))

        fields, invalid = merge_intake_fields(existing, extraction, service_type)
        missing = missing_fields_for(service_type, fields)
        intake = Intake(
            service_type=service_type,
            fields=fields,
            missing_fields=missing,
            invalid_fields=invalid,
        )
        preview_ready = not missing and not invalid
        result = IntakeResult(
            route="L2",
            outcome="preview_ready" if preview_ready else "collecting",
            reply=build_l2_reply(
                missing,
                invalid,
                preview_ready=preview_ready,
                user_message=context.message.content,
                service_type=service_type,
                switched=switched,
            ),
            citations=[],
            intake=intake,
            handover=None,
        )
        return {"extracted_fields": extraction, "result": result}

    return l2_node
