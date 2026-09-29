from __future__ import annotations

import time
from typing import Any

from campus247.agents.draft_templates import template_draft
from campus247.agents.llm_invoke import (
    OFFICER_BUDGET_SECONDS,
    PROVIDER_CALL_TIMEOUT_SECONDS,
    ainvoke_structured,
    remaining_timeout,
)
from campus247.agents.prompts.officer import DRAFTER_SYSTEM
from campus247.agents.snapshot_text import format_officer_context, format_passages
from campus247.agents.state import DraftOutput, OfficerState
from campus247.models.contracts_v1 import Citation, TicketSnapshot, WarningItem


def citations_from_chunk_ids(snapshot: TicketSnapshot, chunk_ids: list[str]) -> tuple[list[Citation], list[str]]:
    by_chunk = {item.citation.chunk_id: item.citation for item in snapshot.approved_sources}
    citations: list[Citation] = []
    unknown: list[str] = []
    seen: set[str] = set()
    for chunk_id in chunk_ids:
        if chunk_id in seen:
            continue
        seen.add(chunk_id)
        citation = by_chunk.get(chunk_id)
        if citation is None:
            unknown.append(chunk_id)
            continue
        citations.append(citation)
    return citations, unknown


def make_drafter_node(model: Any, *, provider_timeout: float = PROVIDER_CALL_TIMEOUT_SECONDS):
    async def drafter_node(state: OfficerState) -> dict:
        snapshot = state["snapshot"]
        started_at = float(state.get("started_at") or time.monotonic())
        timeout = remaining_timeout(started_at, OFFICER_BUDGET_SECONDS, provider_timeout)
        existing = snapshot.existing_officer_draft or "không có"
        sources = snapshot.approved_sources
        if sources:
            user_content = (
                f"{format_officer_context(snapshot, summary=state.get('summary'))}\n"
                f"existing_officer_draft={existing}\n"
                f"approved_sources:\n{format_passages(sources)}\n"
                "Chỉ trích dẫn chunk_id có trong approved_sources. "
                "Điền used_chunk_ids khớp các đoạn đã dùng. Không bịa title, version, quote, locator, url."
            )
        else:
            user_content = (
                f"{format_officer_context(snapshot, summary=state.get('summary'))}\n"
                f"existing_officer_draft={existing}\n"
                "Không có approved_sources. Không nêu căn cứ quy chế. used_chunk_ids phải rỗng."
            )
        messages = [
            {"role": "system", "content": DRAFTER_SYSTEM},
            {"role": "user", "content": user_content},
        ]
        draft = await ainvoke_structured(
            model,
            DraftOutput,
            messages,
            stage="brief",
            request_id=snapshot.request_id,
            timeout=timeout,
            retry_transient=False,
        )
        if not isinstance(draft, DraftOutput):
            draft = DraftOutput.model_validate(draft)
        warnings = list(state.get("warnings") or [])
        warnings.extend(draft.warnings)
        text = draft.draft_reply
        if sources:
            citations, unknown = citations_from_chunk_ids(snapshot, draft.used_chunk_ids)
            for chunk_id in unknown:
                warnings.append(
                    WarningItem(
                        code="citation_unapproved",
                        message=f"Bỏ chunk_id {chunk_id} ngoài approved_sources.",
                    )
                )
            if text is None or not text.strip():
                text = template_draft(snapshot, grounded=True)
                citations = []
        else:
            citations = []
            if text is None or not text.strip():
                text = template_draft(snapshot, grounded=False)
            warnings.append(
                WarningItem(
                    code="no_policy_source",
                    message="Chưa có approved_sources; draft chỉ là mẫu tiếp nhận, không nêu căn cứ quy chế.",
                )
            )
        return {
            "draft_reply": text.strip() if text else None,
            "citations": citations,
            "warnings": warnings,
        }

    return drafter_node
