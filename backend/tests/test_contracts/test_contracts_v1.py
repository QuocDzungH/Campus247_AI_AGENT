"""Validate shared wire examples and cross-field rules, without an LLM or DB."""

import json
from copy import deepcopy
from pathlib import Path

import pytest
from pydantic import ValidationError
from scripts.export_contracts_v1 import artifacts, example_cases, openapi_document

from campus247.models import contracts_v1 as c

ROOT = Path(__file__).resolve().parents[3]
CASES = {case["name"]: case for case in example_cases()}


@pytest.mark.parametrize("case", list(CASES.values()), ids=list(CASES))
def test_examples_validate_and_round_trip(case):
    model = getattr(c, case["model"])
    parsed = model.model_validate(case["payload"])
    assert model.model_validate_json(parsed.model_dump_json()) == parsed


@pytest.mark.parametrize(
    ("case_name", "path", "value"),
    [
        ("rag_answered", "citations", []),
        ("retrieval_found", "passages", []),
        ("retrieval_empty", "status", "found"),
        ("submit1", "confirmed", False),
        ("submit1", "student_id", "SV024"),
        ("submit2", "expected_revision", 0),
        ("submit2", "action", "approve_grade_change"),
        ("claim", "confirmed", False),
        ("claim", "expected_revision", 0),
        ("intake_preview", "intake.fields.receive_method", "email"),
        ("intake_preview", "intake.fields.purpose", None),
        ("intake_handover", "reply", "Đã tạo ticket TKT-FAKE"),
        ("intake_handover", "handover", None),
        ("intake_preview", "route", "L4"),
        ("chat_handover_completed", "ticket", None),
        ("chat_handover_completed", "ticket.priority", "normal"),
        ("chat_handover_completed", "ticket.status", "open"),
        ("chat_handover_completed", "reply.ticket_id", "other_ticket"),
        ("chat_handover_completed", "conversation_state.ai_response_locked", False),
        ("chat_handover_completed", "conversation_state.handover_status", "failed"),
        ("chat_preview", "preview.can_submit", False),
        ("chat_collecting", "preview.can_submit", True),
        ("chat_preview", "reply.conversation_id", "other_conversation"),
        ("chat_preview", "reply.created_at", "2026-09-29T03:00:00"),
        ("ticket_snapshot", "source_ticket_revision", 2),
        ("officer_brief", "facts.0.verification_status", "verified"),
        ("officer_brief", "checklist.0.checked", True),
        ("officer_brief", "suggested_priority", "high"),
        ("brief_ready", "current_ticket_revision", 2),
        ("brief_ready", "brief_version", 2),
        ("brief_failed", "error", None),
    ],
)
def test_rejects_invalid_or_unsafe_wire_payloads(case_name, path, value):
    case = CASES[case_name]
    payload = deepcopy(case["payload"])
    cursor = payload
    keys = path.split(".")
    for key in keys[:-1]:
        cursor = cursor[int(key)] if isinstance(cursor, list) else cursor[key]
    cursor[keys[-1]] = value
    with pytest.raises(ValidationError):
        getattr(c, case["model"]).model_validate(payload)


def test_failed_quality_is_visible_as_completed_artifact_not_technical_failure():
    payload = deepcopy(CASES["brief_ready"]["payload"])
    payload["artifact"]["brief"].update(
        quality_status="fail",
        draft_reply=None,
        warnings=[{"code": "INSUFFICIENT_SOURCE", "message": "Chưa đủ nguồn để soạn phản hồi"}],
    )
    assert c.BriefEnvelope.model_validate(payload).artifact.brief.quality_status == "fail"


def test_openapi_refs_resolve_and_operations_are_unique():
    document = openapi_document()

    def walk(value):
        if isinstance(value, dict):
            if "$ref" in value:
                cursor = document
                for key in value["$ref"].removeprefix("#/").split("/"):
                    cursor = cursor[key]
            for child in value.values():
                walk(child)
        elif isinstance(value, list):
            for child in value:
                walk(child)

    walk(document)
    ids = [operation["operationId"] for methods in document["paths"].values() for operation in methods.values()]
    assert len(ids) == len(set(ids))


@pytest.mark.parametrize("name", ["p0-v1.openapi.json", "p0-v1.examples.json"])
def test_generated_contract_files_match_source(name):
    checked_in = json.loads((ROOT / "docs" / "contracts" / name).read_text(encoding="utf-8"))
    assert checked_in == artifacts()[name]


def test_module_error_has_safe_typed_payload():
    error = c.ModuleError(code="PROVIDER_TIMEOUT", retryable=True, stage="routing", request_id="req_001")
    with pytest.raises(c.ModuleCallError) as exc:
        raise c.ModuleCallError(error)
    assert exc.value.error == error
    assert str(exc.value) == "PROVIDER_TIMEOUT"
