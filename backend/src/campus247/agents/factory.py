"""Compose graphs into CampusAgent. This module does not read API keys or pick a provider."""

from __future__ import annotations

from typing import Any, Protocol

from campus247.agents.adapter import CampusAgent
from campus247.agents.intake_graph import build_intake_graph
from campus247.agents.llm_invoke import (
    INTAKE_BUDGET_SECONDS,
    OFFICER_BUDGET_SECONDS,
    PROVIDER_CALL_TIMEOUT_SECONDS,
)
from campus247.agents.officer_graph import build_officer_graph
from campus247.models.ports_v1 import RagPort


class StructuredChatModel(Protocol):
    def with_structured_output(self, schema: type, **kwargs: Any) -> Any: ...


def create_agent(
    model: StructuredChatModel,
    rag: RagPort,
    *,
    intake_timeout: float = INTAKE_BUDGET_SECONDS,
    officer_timeout: float = OFFICER_BUDGET_SECONDS,
    provider_timeout: float = PROVIDER_CALL_TIMEOUT_SECONDS,
    model_name: str | None = None,
    index_version: str | None = None,
) -> CampusAgent:
    intake = build_intake_graph(model, rag, provider_timeout=provider_timeout)
    officer = build_officer_graph(model, provider_timeout=provider_timeout)
    return CampusAgent(
        intake,
        officer,
        intake_timeout=intake_timeout,
        officer_timeout=officer_timeout,
        model_name=model_name or "campus-agent",
        index_version=index_version,
    )
