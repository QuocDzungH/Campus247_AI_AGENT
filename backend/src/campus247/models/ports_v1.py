"""Implement these async ports; backend owns all calls and persistence boundaries."""

from typing import Protocol

from campus247.models.contracts_v1 import (
    IntakeContext,
    IntakeResult,
    OfficerBrief,
    RagRequest,
    RagResult,
    RetrievalRequest,
    RetrievalResult,
    TicketSnapshot,
)


class RagPort(Protocol):
    async def retrieve_policy(self, request: RetrievalRequest) -> RetrievalResult: ...

    async def answer_question(self, request: RagRequest) -> RagResult: ...


class AgentPort(Protocol):
    async def run_intake(self, context: IntakeContext) -> IntakeResult: ...

    async def prepare_officer_brief(self, snapshot: TicketSnapshot) -> OfficerBrief: ...
