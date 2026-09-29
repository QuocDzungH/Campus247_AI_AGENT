"""Runtime metadata stored with officer-brief artifacts. Model output does not set these fields."""

from __future__ import annotations

from typing import Any

from campus247.agents.prompts import PROMPT_VERSIONS

STUB_MODEL_NAME = "stub-agent"


def officer_prompt_pack() -> str:
    return "/".join(
        [
            PROMPT_VERSIONS["officer"],
            PROMPT_VERSIONS["dossier"],
            PROMPT_VERSIONS["triage"],
            PROMPT_VERSIONS["drafter"],
        ]
    )


def build_brief_artifact_metadata(*, model_name: str, index_version: str | None = None) -> dict[str, str | None]:
    return {
        "model_name": model_name,
        "prompt_version": officer_prompt_pack(),
        "template_version": PROMPT_VERSIONS["drafter"],
        "index_version": index_version,
    }


def metadata_from_agent(agent: Any) -> dict[str, str | None]:
    getter = getattr(agent, "brief_artifact_metadata", None)
    if callable(getter):
        data = getter()
    elif isinstance(getter, dict):
        data = getter
    else:
        data = {}
    return {
        "model_name": str(data.get("model_name") or STUB_MODEL_NAME),
        "prompt_version": str(data.get("prompt_version") or "1"),
        "template_version": str(data.get("template_version") or "1"),
        "index_version": data.get("index_version"),
    }
