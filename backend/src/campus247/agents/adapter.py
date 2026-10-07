from __future__ import annotations

import asyncio
import logging
import time
from typing import Any

from campus247.agents.errors import Stage, map_provider_error, module_error
from campus247.agents.llm_invoke import INTAKE_BUDGET_SECONDS, OFFICER_BUDGET_SECONDS
from campus247.agents.metadata import build_brief_artifact_metadata
from campus247.models.contracts_v1 import IntakeContext, IntakeResult, ModuleCallError, OfficerBrief, TicketSnapshot

logger = logging.getLogger("campus247.agents")


class CampusAgent:
    """AgentPort adapter. Graphs receive injected model/RagPort; this class does not read secrets."""

    def __init__(
        self,
        intake_graph: Any,
        officer_graph: Any,
        *,
        intake_timeout: float = INTAKE_BUDGET_SECONDS,
        officer_timeout: float = OFFICER_BUDGET_SECONDS,
        model_name: str = "campus-agent",
        index_version: str | None = None,
    ) -> None:
        self._intake = intake_graph
        self._officer = officer_graph
        self._intake_timeout = intake_timeout
        self._officer_timeout = officer_timeout
        self._model_name = model_name
        self._index_version = index_version

    def brief_artifact_metadata(self) -> dict[str, str | None]:
        return build_brief_artifact_metadata(model_name=self._model_name, index_version=self._index_version)

    async def run_intake(self, context: IntakeContext) -> IntakeResult:
        request_id = context.request_id
        started_at = time.monotonic()
        try:
            final = await asyncio.wait_for(
                self._intake.ainvoke({"context": context, "started_at": started_at}),
                timeout=self._intake_timeout,
            )
        except ModuleCallError:
            raise
        except TimeoutError as exc:
            raise module_error("PROVIDER_TIMEOUT", stage="intake", request_id=request_id) from exc
        except Exception as exc:
            raise map_provider_error(exc, stage="intake", request_id=request_id) from exc
        return _require_result(final, IntakeResult, request_id, stage="intake")

    async def prepare_officer_brief(self, snapshot: TicketSnapshot) -> OfficerBrief:
        request_id = snapshot.request_id
        started_at = time.monotonic()
        try:
            final = await asyncio.wait_for(
                self._officer.ainvoke({"snapshot": snapshot, "started_at": started_at}),
                timeout=self._officer_timeout,
            )
        except ModuleCallError:
            raise
        except TimeoutError as exc:
            raise module_error("PROVIDER_TIMEOUT", stage="brief", request_id=request_id) from exc
        except Exception as exc:
            raise map_provider_error(exc, stage="brief", request_id=request_id) from exc
        return _require_result(final, OfficerBrief, request_id, stage="brief")


def _require_result(final: dict, schema: type, request_id: str, *, stage: Stage):
    key = "result" if schema is IntakeResult else "brief"
    payload = final.get(key)
    if payload is None and final.get("error") is not None:
        raise ModuleCallError(final["error"])
    if payload is None:
        logger.warning("graph_missing_output stage=%s request_id=%s", stage, request_id)
        raise module_error("OUTPUT_SCHEMA_INVALID", stage=stage, request_id=request_id)
    if isinstance(payload, schema):
        return payload
    try:
        return schema.model_validate(payload)
    except Exception as exc:
        raise module_error("OUTPUT_SCHEMA_INVALID", stage=stage, request_id=request_id) from exc
