from __future__ import annotations

from typing import Any, Literal

from langgraph.graph import END, START, StateGraph

from campus247.agents.llm_invoke import PROVIDER_CALL_TIMEOUT_SECONDS
from campus247.agents.nodes.intake_l1 import make_l1_node
from campus247.agents.nodes.intake_l2 import make_l2_node
from campus247.agents.nodes.intake_l4 import l4_node
from campus247.agents.nodes.intake_router import make_router_node
from campus247.agents.state import IntakeState, RouteDecision
from campus247.models.ports_v1 import RagPort


def _branch(state: IntakeState) -> Literal["L1", "L2", "L4"]:
    decision = state["decision"]
    if not isinstance(decision, RouteDecision):
        decision = RouteDecision.model_validate(decision)
    return decision.route


def build_intake_graph(
    model: Any,
    rag: RagPort,
    *,
    provider_timeout: float = PROVIDER_CALL_TIMEOUT_SECONDS,
):
    graph = StateGraph(IntakeState)
    graph.add_node("route", make_router_node(model, provider_timeout=provider_timeout))
    graph.add_node("l1", make_l1_node(model, rag, provider_timeout=provider_timeout))
    graph.add_node("l2", make_l2_node(model, provider_timeout=provider_timeout))
    graph.add_node("l4", l4_node)
    graph.add_edge(START, "route")
    graph.add_conditional_edges("route", _branch, {"L1": "l1", "L2": "l2", "L4": "l4"})
    graph.add_edge("l1", END)
    graph.add_edge("l2", END)
    graph.add_edge("l4", END)
    return graph.compile()
