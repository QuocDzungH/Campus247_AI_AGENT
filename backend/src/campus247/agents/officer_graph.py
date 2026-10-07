from __future__ import annotations

from typing import Any

from langgraph.graph import END, START, StateGraph

from campus247.agents.llm_invoke import PROVIDER_CALL_TIMEOUT_SECONDS
from campus247.agents.nodes.dossier import make_dossier_node, validate_snapshot
from campus247.agents.nodes.drafter import make_drafter_node
from campus247.agents.nodes.quality import quality_node
from campus247.agents.nodes.triage import make_triage_node
from campus247.agents.state import OfficerState


def build_officer_graph(model: Any, *, provider_timeout: float = PROVIDER_CALL_TIMEOUT_SECONDS):
    graph = StateGraph(OfficerState)
    graph.add_node("validate", validate_snapshot)
    graph.add_node("dossier", make_dossier_node(model, provider_timeout=provider_timeout))
    graph.add_node("triage", make_triage_node(model, provider_timeout=provider_timeout))
    graph.add_node("draft", make_drafter_node(model, provider_timeout=provider_timeout))
    graph.add_node("quality", quality_node)
    graph.add_edge(START, "validate")
    graph.add_edge("validate", "dossier")
    graph.add_edge("dossier", "triage")
    graph.add_edge("triage", "draft")
    graph.add_edge("draft", "quality")
    graph.add_edge("quality", END)
    return graph.compile()
