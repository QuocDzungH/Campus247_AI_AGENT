"""Async structured-output helper with timeout, one transient retry, and JSON fallback."""

from __future__ import annotations

import asyncio
import json
import logging
import time
from typing import Any

from pydantic import BaseModel, ValidationError

from campus247.agents.errors import Stage, map_provider_error, module_error

logger = logging.getLogger("campus247.agents")

INTAKE_BUDGET_SECONDS = 25.0
OFFICER_BUDGET_SECONDS = 60.0
PROVIDER_CALL_TIMEOUT_SECONDS = 10.0


def remaining_timeout(started_at: float, total: float, per_call: float) -> float:
    left = total - (time.monotonic() - started_at)
    if left <= 0:
        raise TimeoutError("agent budget exhausted")
    return min(per_call, left)


def _content_text(raw: Any) -> str:
    content = getattr(raw, "content", raw)
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for item in content:
            if isinstance(item, str):
                parts.append(item)
            elif isinstance(item, dict) and item.get("text"):
                parts.append(str(item["text"]))
        return "".join(parts)
    return str(content)


async def ainvoke_structured(
    model: Any,
    schema: type[BaseModel],
    messages: Any,
    *,
    stage: Stage,
    request_id: str,
    timeout: float,
    retry_transient: bool = False,
) -> BaseModel:
    """Call with_structured_output; fall back to plain JSON if the model lacks native support."""

    async def _once() -> BaseModel:
        if hasattr(model, "with_structured_output"):
            runnable = model.with_structured_output(schema)
            raw = await asyncio.wait_for(runnable.ainvoke(messages), timeout=timeout)
            if isinstance(raw, schema):
                return raw
            return schema.model_validate(raw)

        if not hasattr(model, "ainvoke"):
            raise module_error("OUTPUT_SCHEMA_INVALID", stage=stage, request_id=request_id)
        fallback_messages = list(messages) + [
            {
                "role": "system",
                "content": "Trả về JSON thuần khớp schema, không Markdown, không code fence.",
            }
        ]
        raw = await asyncio.wait_for(model.ainvoke(fallback_messages), timeout=timeout)
        payload = _content_text(raw).strip()
        try:
            return schema.model_validate_json(payload)
        except ValidationError:
            return schema.model_validate(json.loads(payload))

    try:
        return await _once()
    except Exception as exc:
        mapped = map_provider_error(exc, stage=stage, request_id=request_id)
        if not retry_transient or not mapped.error.retryable:
            raise mapped from exc
        logger.info("retrying provider call stage=%s request_id=%s", stage, request_id)
        try:
            return await _once()
        except Exception as retry_exc:
            raise map_provider_error(retry_exc, stage=stage, request_id=request_id) from retry_exc
