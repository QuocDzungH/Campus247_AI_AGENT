from __future__ import annotations

import time
from typing import Any

from campus247.agents.errors import module_error
from campus247.agents.guards import source_registry_from_snapshot
from campus247.agents.llm_invoke import (
    OFFICER_BUDGET_SECONDS,
    PROVIDER_CALL_TIMEOUT_SECONDS,
    ainvoke_structured,
    remaining_timeout,
)
from campus247.agents.prompts.officer import DOSSIER_SYSTEM
from campus247.agents.provenance import deterministic_facts
from campus247.agents.snapshot_text import format_officer_context
from campus247.agents.state import DossierOutput, OfficerState
from campus247.models.contracts_v1 import MissingItem, TicketSnapshot


def validate_snapshot(state: OfficerState) -> dict:
    snapshot = state["snapshot"]
    if not isinstance(snapshot, TicketSnapshot):
        snapshot = TicketSnapshot.model_validate(snapshot)
    if snapshot.ticket.id.strip() == "":
        raise module_error("OUTPUT_SCHEMA_INVALID", stage="validation", request_id=snapshot.request_id)
    if snapshot.source_ticket_revision != snapshot.ticket.revision:
        raise module_error("SOURCE_REFERENCE_INVALID", stage="validation", request_id=snapshot.request_id)
    registry = source_registry_from_snapshot(snapshot)
    return {"snapshot": snapshot, "source_registry": registry}


def deterministic_missing(snapshot: TicketSnapshot) -> list[MissingItem]:
    items: list[MissingItem] = []
    packet = snapshot.intake_packet
    if packet is not None:
        for field in packet.missing_fields:
            items.append(MissingItem(field=field, reason="Sinh viên chưa cung cấp trường này."))
        for issue in packet.invalid_fields:
            items.append(MissingItem(field=issue.field, reason=issue.reason))
    if snapshot.ticket.service_type == "academic_complaint" and not snapshot.handover_packet:
        items.append(MissingItem(field="complaint_detail", reason="Cần cán bộ kiểm tra nội dung khiếu nại và minh chứng."))
    if snapshot.ticket.service_type == "student_support":
        items.append(MissingItem(field="support_followup", reason="Cần cán bộ xác nhận phạm vi hỗ trợ và người được phép xem."))
    return items


def fallback_summary(snapshot: TicketSnapshot) -> str:
    return snapshot.ticket.summary.strip()[:2000] or "Ticket cần cán bộ xem xét hồ sơ đã ghi nhận."


def make_dossier_node(model: Any, *, provider_timeout: float = PROVIDER_CALL_TIMEOUT_SECONDS):
    async def dossier_node(state: OfficerState) -> dict:
        snapshot = state["snapshot"]
        base_facts = deterministic_facts(snapshot)
        missing = deterministic_missing(snapshot)
        started_at = float(state.get("started_at") or time.monotonic())
        timeout = remaining_timeout(started_at, OFFICER_BUDGET_SECONDS, provider_timeout)
        messages = [
            {"role": "system", "content": DOSSIER_SYSTEM},
            {"role": "user", "content": format_officer_context(snapshot)},
        ]
        dossier = await ainvoke_structured(
            model,
            DossierOutput,
            messages,
            stage="brief",
            request_id=snapshot.request_id,
            timeout=timeout,
            retry_transient=False,
        )
        if not isinstance(dossier, DossierOutput):
            dossier = DossierOutput.model_validate(dossier)
        facts = list(base_facts)
        seen = {(item.key, item.source_id) for item in facts}
        for extra in dossier.extra_facts:
            key = (extra.key, extra.source_id)
            if key in seen:
                continue
            seen.add(key)
            facts.append(extra)
        missing_keys = {item.field for item in missing}
        for item in dossier.missing_items:
            if item.field not in missing_keys:
                missing.append(item)
                missing_keys.add(item.field)
        summary = dossier.summary.strip()[:2000] or fallback_summary(snapshot)
        return {"summary": summary, "facts": facts, "missing_items": missing}

    return dossier_node
