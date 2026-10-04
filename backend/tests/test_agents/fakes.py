from __future__ import annotations

import inspect
from typing import Any

from pydantic import BaseModel, ValidationError


class ScriptedChatModel:
    """Deterministic stand-in for BaseChatModel.with_structured_output. No network."""

    def __init__(self, by_schema: dict[str, Any] | None = None) -> None:
        self.by_schema = dict(by_schema or {})
        self.calls: list[tuple[str, Any]] = []
        self._queues: dict[str, list[Any]] = {
            name: list(spec) for name, spec in self.by_schema.items() if isinstance(spec, list)
        }

    def with_structured_output(self, schema: type[BaseModel], **kwargs: Any):
        parent = self

        class _Runnable:
            async def ainvoke(self, input: Any, config: Any = None) -> BaseModel:
                name = schema.__name__
                parent.calls.append((name, input))
                spec = parent.by_schema.get(name)
                if spec is None:
                    raise ValueError(f"no script for {name}")
                if isinstance(spec, list):
                    queue = parent._queues.setdefault(name, list(spec))
                    if not queue:
                        raise ValueError(f"script exhausted for {name}")
                    spec = queue.pop(0)
                result = spec
                if callable(spec):
                    result = spec(input)
                    if inspect.isawaitable(result):
                        result = await result
                if isinstance(result, BaseException):
                    raise result
                if isinstance(result, schema):
                    return result
                try:
                    return schema.model_validate(result)
                except ValidationError:
                    raise

        return _Runnable()
