from __future__ import annotations

import time
from typing import Any, Literal

from pydantic import ValidationError

from campus247.agents.errors import module_error
from campus247.agents.llm_invoke import (
    INTAKE_BUDGET_SECONDS,
    PROVIDER_CALL_TIMEOUT_SECONDS,
    ainvoke_structured,
    remaining_timeout,
)
from campus247.agents.prompts.intake import L2_EXTRACT_SYSTEM
from campus247.agents.state import CertificateField, FieldExtraction, IntakeState
from campus247.models.contracts_v1 import FieldIssue, Fields, Intake, IntakeContext, IntakeResult

VAGUE_PURPOSE = {"gấp", "gap", "nhanh", "asap", "gấp luôn", "gấp gáp"}

_FIELD_QUESTIONS: dict[CertificateField, str] = {
    "purpose": "mục đích sử dụng giấy",
    "destination_org": "nơi nộp giấy",
    "receive_method": "hình thức nhận (bản điện tử PDF hoặc bản giấy đóng dấu)",
}


def _usable(field: CertificateField, value: str | None) -> tuple[bool, str | None]:
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
    if stripped in {"digital_pdf", "paper_stamped"}:
        return True, stripped
    return False, "Bạn chọn bản điện tử PDF hoặc bản giấy đóng dấu."


def merge_certificate_fields(
    existing: Fields | None,
    extraction: FieldExtraction,
) -> tuple[Fields, list[FieldIssue]]:
    current = existing.model_dump() if existing is not None else {
        "purpose": None,
        "destination_org": None,
        "receive_method": None,
    }
    invalid = list(extraction.invalid_fields)
    invalid_names = {item.field for item in invalid}
    provided = list(dict.fromkeys(extraction.provided_fields))

    for field in provided:
        raw = getattr(extraction, field)
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
        safe = {
            "purpose": current["purpose"] if current.get("purpose") and len(str(current["purpose"])) >= 5 else None,
            "destination_org": current.get("destination_org"),
            "receive_method": current.get("receive_method") if current.get("receive_method") in {
                "digital_pdf",
                "paper_stamped",
            }
            else None,
        }
        fields = Fields.model_validate(safe)
        for key, value in current.items():
            if value is not None and getattr(fields, key) is None and key not in {item.field for item in invalid}:
                invalid.append(FieldIssue(field=key, reason="Giá trị chưa đủ điều kiện để lưu."))
    return fields, invalid


def build_l2_reply(missing: list[str], invalid: list[FieldIssue], *, preview_ready: bool) -> str:
    if preview_ready:
        return "Bạn hãy kiểm tra thông tin trước khi gửi."
    needed: list[str] = []
    for item in invalid:
        needed.append(_FIELD_QUESTIONS[item.field])
    for field in missing:
        label = _FIELD_QUESTIONS[field]
        if label not in needed:
            needed.append(label)
    if not needed:
        needed = list(_FIELD_QUESTIONS.values())
    if len(needed) == 1:
        return f"Bạn cho biết {needed[0]}."
    if len(needed) == 2:
        return f"Bạn cho biết {needed[0]} và {needed[1]}."
    return f"Bạn cho biết {needed[0]}, {needed[1]} và {needed[2]}."


def make_l2_node(model: Any, *, provider_timeout: float = PROVIDER_CALL_TIMEOUT_SECONDS):
    async def l2_node(state: IntakeState) -> dict:
        context = state["context"]
        if not isinstance(context, IntakeContext):
            context = IntakeContext.model_validate(context)
        messages = [
            {"role": "system", "content": L2_EXTRACT_SYSTEM},
            {
                "role": "user",
                "content": (
                    f"Tin hiện tại: {context.message.content}\n"
                    f"Preview fields: "
                    f"{context.preview.fields.model_dump_json() if context.preview is not None else 'null'}"
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

        existing = context.preview.fields if context.preview is not None else None
        fields, invalid = merge_certificate_fields(existing, extraction)
        missing: list[Literal["purpose", "destination_org", "receive_method"]] = [
            key for key, value in fields.model_dump().items() if value is None
        ]
        intake = Intake(
            service_type="student_certificate",
            fields=fields,
            missing_fields=missing,
            invalid_fields=invalid,
        )
        preview_ready = not missing and not invalid
        result = IntakeResult(
            route="L2",
            outcome="preview_ready" if preview_ready else "collecting",
            reply=build_l2_reply(missing, invalid, preview_ready=preview_ready),
            citations=[],
            intake=intake,
            handover=None,
        )
        return {"extracted_fields": extraction, "result": result}

    return l2_node
