from __future__ import annotations

import asyncio
import time

from campus247.agents.errors import map_provider_error, module_error
from campus247.agents.llm_invoke import (
    INTAKE_BUDGET_SECONDS,
    PROVIDER_CALL_TIMEOUT_SECONDS,
    ainvoke_structured,
    remaining_timeout,
)
from campus247.agents.prompts.intake import L1_GROUNDED_SYSTEM
from campus247.agents.state import GroundedL1Answer, IntakeState
from campus247.models.contracts_v1 import (
    IntakeContext,
    IntakeResult,
    ModuleCallError,
    RagRequest,
    RagResult,
    RetrievalRequest,
)
from campus247.models.ports_v1 import RagPort
from campus247.services.common import MSG_L1_EMPTY


def make_l1_node(model, rag: RagPort, *, provider_timeout: float = PROVIDER_CALL_TIMEOUT_SECONDS):
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
            if not getattr(rag, "requires_grounded_generation", False):
                rag_result = await asyncio.wait_for(rag.answer_question(request), timeout=timeout)
            else:
                retrieval = await asyncio.wait_for(
                    rag.retrieve_policy(
                        RetrievalRequest(
                            query=request.question,
                            policy_scope=request.policy_scope,
                            top_k=5,
                            effective_at=request.effective_at,
                        )
                    ),
                    timeout=timeout,
                )
                if retrieval.status == "empty":
                    rag_result = RagResult(status="insufficient_evidence", answer=MSG_L1_EMPTY, citations=[])
                else:
                    generation = await ainvoke_structured(
                        model,
                        GroundedL1Answer,
                        [
                            {"role": "system", "content": L1_GROUNDED_SYSTEM},
                            {"role": "user", "content": _grounded_input(request.question, retrieval.passages)},
                        ],
                        stage="generation",
                        request_id=context.request_id,
                        timeout=remaining_timeout(started_at, INTAKE_BUDGET_SECONDS, provider_timeout),
                    )
                    if generation.outcome == "insufficient_evidence":
                        rag_result = RagResult(status="insufficient_evidence", answer=generation.answer, citations=[])
                    else:
                        citations = _citations_from_chunk_ids(
                            retrieval.passages, generation.used_chunk_ids, context.request_id
                        )
                        rag_result = RagResult(status="answered", answer=generation.answer, citations=citations)
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


def _grounded_input(question: str, passages) -> str:
    blocks = []
    for item in passages:
        citation = item.citation
        blocks.append(
            f"chunk_id={citation.chunk_id}\n"
            f"title={citation.document_title}\n"
            f"locator={citation.locator}\n"
            f"text={item.text}"
        )
    return f"Câu hỏi: {question}\n\nĐoạn tài liệu được phép dùng:\n\n" + "\n\n---\n\n".join(blocks)


def _citations_from_chunk_ids(passages, chunk_ids: list[str], request_id: str):
    by_id = {item.citation.chunk_id: item.citation for item in passages}
    citations = []
    seen = set()
    for chunk_id in chunk_ids:
        if chunk_id in seen:
            continue
        seen.add(chunk_id)
        citation = by_id.get(chunk_id)
        if citation is None:
            raise module_error("SOURCE_REFERENCE_INVALID", stage="validation", request_id=request_id)
        citations.append(citation)
    if not citations:
        raise module_error("SOURCE_REFERENCE_INVALID", stage="validation", request_id=request_id)
    return citations
