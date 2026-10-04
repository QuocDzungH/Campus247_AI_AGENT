from campus247.agents.guards import guard_officer_brief, source_registry_from_snapshot
from campus247.agents.state import OfficerState
from campus247.models.contracts_v1 import OfficerBrief


def quality_node(state: OfficerState) -> dict:
    snapshot = state["snapshot"]
    registry = state.get("source_registry") or source_registry_from_snapshot(snapshot)
    brief = OfficerBrief(
        ticket_id=snapshot.ticket.id,
        source_ticket_revision=snapshot.source_ticket_revision,
        summary=(state.get("summary") or snapshot.ticket.summary)[:2000],
        facts=list(state.get("facts") or []),
        missing_items=list(state.get("missing_items") or []),
        checklist=list(state.get("checklist") or []),
        suggested_priority=state["suggested_priority"],
        priority_reasons=list(state.get("priority_reasons") or []),
        draft_reply=state.get("draft_reply"),
        citations=list(state.get("citations") or []),
        warnings=list(state.get("warnings") or []),
        quality_status="pass",
    )
    guarded = guard_officer_brief(snapshot, brief, registry)
    return {
        "brief": guarded,
        "quality_status": guarded.quality_status,
        "warnings": guarded.warnings,
        "draft_reply": guarded.draft_reply,
        "facts": guarded.facts,
        "checklist": guarded.checklist,
        "citations": guarded.citations,
    }
