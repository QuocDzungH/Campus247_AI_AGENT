from __future__ import annotations

import asyncio
import time

from campus247.agents.errors import map_provider_error
from campus247.agents.llm_invoke import INTAKE_BUDGET_SECONDS, PROVIDER_CALL_TIMEOUT_SECONDS, remaining_timeout
from campus247.agents.state import IntakeState
from campus247.models.contracts_v1 import IntakeContext, IntakeResult, ModuleCallError, RagRequest
from campus247.models.ports_v1 import RagPort


def make_l1_node(rag: RagPort, *, provider_timeout: float = PROVIDER_CALL_TIMEOUT_SECONDS):
    async def l1_node(state: IntakeState) -> dict:
        context = state["context"]
        if not isinstance(context, IntakeContext):
            context = IntakeContext.model_validate(context)
        request = RagRequest(
            question=context.message.content,
            history=list(context.history),
            policy_scope=context.policy_scope,
            effective_at=context.effective_at,
        )
        try:
            started_at = float(state.get("started_at") or time.monotonic())
            timeout = remaining_timeout(started_at, INTAKE_BUDGET_SECONDS, provider_timeout)
            rag_result = await asyncio.wait_for(rag.answer_question(request), timeout=timeout)
        except ModuleCallError:
            raise
        except Exception as exc:
            raise map_provider_error(exc, stage="retrieval", request_id=context.request_id) from exc

        result = IntakeResult(
            route="L1",
            outcome=rag_result.status,
            reply=rag_result.answer,
            citations=list(rag_result.citations),
            intake=None,
            handover=None,
        )
        return {"rag_result": rag_result, "result": result}

    return l1_node
