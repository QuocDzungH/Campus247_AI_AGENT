"""Map provider/graph failures onto ModuleCallError without leaking secrets."""

from __future__ import annotations

import asyncio
import logging
from typing import Literal

from pydantic import ValidationError

from campus247.models.contracts_v1 import ModuleCallError, ModuleError

logger = logging.getLogger("campus247.agents")

ErrorCode = Literal[
    "PROVIDER_TIMEOUT",
    "PROVIDER_UNAVAILABLE",
    "PROVIDER_RATE_LIMITED",
    "INDEX_UNAVAILABLE",
    "OUTPUT_SCHEMA_INVALID",
    "SOURCE_REFERENCE_INVALID",
    "POLICY_SCOPE_DENIED",
]
Stage = Literal["retrieval", "generation", "routing", "intake", "brief", "validation"]

RETRYABLE_MODULE_CODES = frozenset(
    {
        "PROVIDER_TIMEOUT",
        "PROVIDER_UNAVAILABLE",
        "PROVIDER_RATE_LIMITED",
        "INDEX_UNAVAILABLE",
    }
)
NON_RETRYABLE_MODULE_CODES = frozenset(
    {
        "OUTPUT_SCHEMA_INVALID",
        "SOURCE_REFERENCE_INVALID",
        "POLICY_SCOPE_DENIED",
    }
)
MODULE_ERROR_CODES = RETRYABLE_MODULE_CODES | NON_RETRYABLE_MODULE_CODES
_RETRYABLE = RETRYABLE_MODULE_CODES


def module_error(
    code: ErrorCode,
    *,
    stage: Stage,
    request_id: str,
    retryable: bool | None = None,
) -> ModuleCallError:
    return ModuleCallError(
        ModuleError(
            code=code,
            retryable=_RETRYABLE.__contains__(code) if retryable is None else retryable,
            stage=stage,
            request_id=request_id,
        )
    )


def map_provider_error(exc: BaseException, *, stage: Stage, request_id: str) -> ModuleCallError:
    if isinstance(exc, ModuleCallError):
        return exc

    name = type(exc).__name__.lower()
    message = str(exc).lower()

    if isinstance(exc, (TimeoutError, asyncio.TimeoutError)) or "timeout" in name or "timeout" in message:
        return module_error("PROVIDER_TIMEOUT", stage=stage, request_id=request_id)
    if "ratelimit" in name or "rate_limit" in name or "429" in message or "rate limit" in message:
        return module_error("PROVIDER_RATE_LIMITED", stage=stage, request_id=request_id)
    if "policy_scope" in message or "scope denied" in message or "policy scope" in message:
        return module_error("POLICY_SCOPE_DENIED", stage=stage, request_id=request_id)
    if isinstance(exc, (ValidationError, ValueError)) or "outputparser" in name or "output_parser" in name:
        return module_error("OUTPUT_SCHEMA_INVALID", stage=stage, request_id=request_id)
    if "index" in name and ("unavailable" in message or "connect" in message):
        return module_error("INDEX_UNAVAILABLE", stage=stage, request_id=request_id)

    logger.warning("provider_error stage=%s type=%s request_id=%s", stage, type(exc).__name__, request_id)
    return module_error("PROVIDER_UNAVAILABLE", stage=stage, request_id=request_id)
