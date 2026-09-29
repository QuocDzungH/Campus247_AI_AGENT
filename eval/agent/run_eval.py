#!/usr/bin/env python3
"""Score the agent eval dataset.

Default run is deterministic: rule router, heuristic L2 fields, L3 provenance/quality guards.
It does not call a provider.

--live builds CampusAgent from settings and scores the same fixtures on the real model.
Refuse --live unless AGENT_MODE=langgraph and LLM settings validate. Exit 2 with no live report.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import re
import sys
import time
from collections import Counter
from datetime import UTC, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend" / "src"))

from campus247.agents.guards import (  # noqa: E402
    guard_officer_brief,
    sanitize_facts,
    source_registry_from_snapshot,
)
from campus247.agents.nodes.dossier import deterministic_facts, deterministic_missing  # noqa: E402
from campus247.agents.nodes.intake_l2 import merge_certificate_fields  # noqa: E402
from campus247.agents.nodes.intake_router import rule_route  # noqa: E402
from campus247.agents.nodes.triage import apply_priority_floor, checklist_for  # noqa: E402
from campus247.agents.prompts import PROMPT_VERSIONS  # noqa: E402
from campus247.agents.state import FieldExtraction, RouteDecision  # noqa: E402
from campus247.models.contracts_v1 import (  # noqa: E402
    Actor,
    Fact,
    Fields,
    Handover,
    Intake,
    IntakeContext,
    Message,
    OfficerBrief,
    Preview,
    Profile,
    Ticket,
    TicketSnapshot,
)

DATASET = Path(__file__).with_name("dataset.jsonl")
DATASET_VERSION = "agent-eval-v3"
NOW = datetime(2026, 9, 29, 8, 0, tzinfo=UTC)
_VAGUE_PURPOSE = {"gấp", "gap", "nhanh", "asap", "gấp luôn", "gấp gáp"}
_PURPOSE = re.compile(r"(?:để|mục đích)\s+([^,.]+)", re.IGNORECASE)
_DEST = re.compile(r"nơi nhận(?: là)?\s+([^,.]+)", re.IGNORECASE)


def load_rows() -> list[dict]:
    rows = []
    for line in DATASET.read_text(encoding="utf-8").splitlines():
        if line.strip():
            rows.append(json.loads(line))
    return rows


def _split_rows(rows: list[dict], split: str | None, layers: set[str]) -> list[dict]:
    selected = [row for row in rows if row["layer"] in layers]
    if split:
        selected = [row for row in selected if row.get("split") == split]
    return selected


def predicted_decision(row: dict) -> RouteDecision | None:
    decision = rule_route(row["content"])
    if decision is not None:
        return decision
    if row.get("preview") or row.get("requires_preview"):
        return RouteDecision(
            route="L2",
            intent="student_certificate",
            reason="Tiếp tục thu thập hồ sơ giấy xác nhận sinh viên.",
            confidence=0.9,
        )
    return None


def score_routes(rows: list[dict], split: str | None) -> dict:
    selected = _split_rows(rows, split, {"L1", "L2", "L4"})
    correct = 0
    l4_false_negative = 0
    l1_false_positive = 0
    risk_ok = 0
    risk_n = 0
    by_layer: Counter[str] = Counter()
    by_layer_ok: Counter[str] = Counter()
    for row in selected:
        decision = predicted_decision(row)
        predicted = decision.route if decision is not None else "UNSURE"
        expected = row["expected_route"]
        by_layer[expected] += 1
        if predicted == expected:
            correct += 1
            by_layer_ok[expected] += 1
        if expected == "L4" and predicted != "L4":
            l4_false_negative += 1
        if expected != "L1" and predicted == "L1":
            l1_false_positive += 1
        if row.get("expected_risk"):
            risk_n += 1
            got_risk = decision.risk_type if decision is not None else None
            if got_risk == row["expected_risk"]:
                risk_ok += 1
    total = len(selected) or 1
    return {
        "n": len(selected),
        "route_accuracy": correct / total,
        "l4_false_negative": l4_false_negative,
        "l1_false_positive_from_other": l1_false_positive,
        "risk_type_accuracy": (risk_ok / risk_n) if risk_n else 0.0,
        "risk_type_n": risk_n,
        "accuracy_by_expected_layer": {
            layer: (by_layer_ok[layer] / by_layer[layer] if by_layer[layer] else 0.0) for layer in sorted(by_layer)
        },
    }


def heuristic_l2_fields(content: str) -> dict[str, str | None]:
    fields: dict[str, str | None] = {"purpose": None, "destination_org": None, "receive_method": None}
    lowered = content.lower()
    if re.search(r"bản điện tử|\bpdf\b", lowered):
        fields["receive_method"] = "digital_pdf"
    elif re.search(r"bản giấy|đóng dấu", lowered):
        fields["receive_method"] = "paper_stamped"
    dest = _DEST.search(content)
    if dest:
        fields["destination_org"] = dest.group(1).strip()
    purpose = _PURPOSE.search(content)
    if purpose:
        value = purpose.group(1).strip()
        if value.lower() not in _VAGUE_PURPOSE and len(value) >= 5:
            fields["purpose"] = value
    return fields


def gold_l2_field_values(row: dict) -> dict[str, str]:
    values = row.get("expected_field_values") or {}
    return {key: str(value) for key, value in values.items() if value}


def normalize_field_value(name: str, value: str | None) -> str | None:
    if value is None:
        return None
    text = " ".join(str(value).strip().lower().split())
    text = re.sub(r"[.,;:]+$", "", text)
    if name == "receive_method":
        return text
    return text


def field_aliases_for(row: dict, name: str) -> list[str]:
    raw = (row.get("field_aliases") or {}).get(name) or []
    return [str(item) for item in raw if item]


def field_value_matches(
    name: str,
    predicted: str | None,
    expected: str,
    *,
    aliases: list[str] | None = None,
) -> bool:
    got = normalize_field_value(name, predicted)
    if not got:
        return False
    accepted = [expected, *(aliases or [])]
    return any(got == normalize_field_value(name, item) for item in accepted if item)


def preview_fields(row: dict) -> Fields | None:
    data = row.get("preview")
    if not data:
        return None
    return Fields.model_validate(
        {
            "purpose": data.get("purpose"),
            "destination_org": data.get("destination_org"),
            "receive_method": data.get("receive_method"),
        }
    )


def heuristic_extraction(content: str) -> FieldExtraction:
    fields = heuristic_l2_fields(content)
    provided = [key for key, value in fields.items() if value]
    return FieldExtraction(provided_fields=provided, **fields)


def resolved_l2_fields(row: dict) -> dict[str, str | None]:
    merged, _ = merge_certificate_fields(preview_fields(row), heuristic_extraction(row["content"]))
    return merged.model_dump()


def heuristic_l2_outcome(row: dict) -> str:
    fields = resolved_l2_fields(row)
    if all(fields.values()):
        return "preview_ready"
    return "collecting"


def score_l2_fields(rows: list[dict], split: str | None) -> dict:
    selected = [row for row in _split_rows(rows, split, {"L2"}) if gold_l2_field_values(row)]
    hits = 0
    total = 0
    by_field: Counter[str] = Counter()
    by_field_ok: Counter[str] = Counter()
    for row in selected:
        extracted = resolved_l2_fields(row)
        for name, expected in gold_l2_field_values(row).items():
            total += 1
            by_field[name] += 1
            if field_value_matches(
                name,
                extracted.get(name),
                expected,
                aliases=field_aliases_for(row, name),
            ):
                hits += 1
                by_field_ok[name] += 1
    return {
        "n": len(selected),
        "field_extraction_accuracy": (hits / total) if total else 0.0,
        "gold_fields": total,
        "accuracy_by_field": {
            name: (by_field_ok[name] / by_field[name] if by_field[name] else 0.0) for name in sorted(by_field)
        },
        "extractor": "deterministic-heuristic",
        "match": "exact-normalized-or-alias",
    }


def score_l2_outcomes(rows: list[dict], split: str | None) -> dict:
    selected = [row for row in _split_rows(rows, split, {"L2"}) if row.get("expected_outcome")]
    correct = 0
    for row in selected:
        if heuristic_l2_outcome(row) == row["expected_outcome"]:
            correct += 1
    return {
        "n": len(selected),
        "outcome_accuracy": (correct / len(selected)) if selected else 0.0,
        "scorer": "deterministic-heuristic",
    }


def score_l2_updates(rows: list[dict], split: str | None) -> dict:
    selected = [row for row in _split_rows(rows, split, {"L2"}) if row.get("expected_updates")]
    hits = 0
    total = 0
    for row in selected:
        extracted = resolved_l2_fields(row)
        gold = gold_l2_field_values(row)
        for name in row["expected_updates"]:
            total += 1
            expected = gold.get(name)
            if expected and field_value_matches(
                name,
                extracted.get(name),
                expected,
                aliases=field_aliases_for(row, name),
            ):
                hits += 1
    return {
        "n": len(selected),
        "update_accuracy": (hits / total) if total else 0.0,
        "gold_updates": total,
        "scorer": "deterministic-heuristic",
    }


def _profile() -> Profile:
    return Profile(
        student_id="SV001",
        full_name="Nguyễn Văn An",
        mssv="SV001",
        faculty="CNTT",
        cohort="K17",
        is_demo=True,
    )


def snapshot_from_row(row: dict) -> TicketSnapshot:
    service = row.get("service_type", "student_certificate")
    priority = row.get("priority", "normal")
    summary = row.get("summary") or "Ticket đánh giá"
    category = "action" if service == "student_certificate" else "complaint"
    missing = list(row.get("missing") or [])
    fields = Fields(
        purpose=None if "purpose" in missing else "Vay vốn ngân hàng",
        destination_org=None if "destination_org" in missing else "Ngân hàng mẫu",
        receive_method=None if "receive_method" in missing else "digital_pdf",
    )
    ticket = Ticket(
        id=f"tkt_{row['id']}",
        code=f"TKT-{row['id']}",
        status="open",
        priority=priority,
        conversation_id="conv_eval",
        student_id="SV001",
        category=category,
        service_type=service,
        priority_reasons=["Ticket đã được gắn ưu tiên cao."] if priority == "high" else [],
        summary=summary,
        request_data=fields if service == "student_certificate" else None,
        handover_reason="Khiếu nại điểm" if service == "academic_complaint" else None,
        assigned_officer_id=None,
        revision=1,
        created_at=NOW,
        updated_at=NOW,
    )
    message = Message(
        id="msg_eval_1",
        conversation_id="conv_eval",
        ticket_id=ticket.id,
        sender="student",
        content=summary,
        created_at=NOW,
    )
    intake = None
    handover = None
    if service == "student_certificate":
        intake = Intake(
            service_type="student_certificate",
            fields=fields,
            missing_fields=missing,
            invalid_fields=[],
        )
    if service in {"academic_complaint", "student_support"}:
        risk = "wellbeing" if service == "student_support" else "academic_complaint"
        handover = Handover(
            risk_type=risk,
            reason="Yêu cầu cần cán bộ tiếp nhận.",
            summary=summary,
            source_message_ids=["msg_eval_1"],
        )
    return TicketSnapshot(
        ticket=ticket,
        source_ticket_revision=1,
        student_profile=_profile(),
        messages=[message],
        intake_packet=intake,
        handover_packet=handover,
        approved_sources=[],
        existing_officer_draft="Draft cán bộ đã lưu." if row.get("existing_officer_draft") else None,
        request_id=f"req_{row['id']}",
    )


def score_l3(rows: list[dict], split: str | None) -> dict:
    selected = _split_rows(rows, split, {"L3"})
    priority_ok = 0
    priority_n = 0
    provenance_ok = 0
    quality_fail_injection = 0
    quality_n = 0
    missing_ok = 0
    missing_n = 0
    draft_warning_ok = 0
    draft_warning_n = 0
    for row in selected:
        snapshot = snapshot_from_row(row)
        registry = source_registry_from_snapshot(snapshot)
        facts = deterministic_facts(snapshot)
        if all((fact.source_type, fact.source_id) in registry for fact in facts):
            provenance_ok += 1
        suggested, reasons = apply_priority_floor(snapshot, "normal", [])
        expected_priority = row.get("expect_priority")
        if expected_priority:
            priority_n += 1
            if suggested == expected_priority and (suggested != "high" or reasons):
                priority_ok += 1
        expected_missing = set(row.get("missing") or [])
        if expected_missing:
            missing_n += 1
            got = {item.field for item in deterministic_missing(snapshot)}
            if expected_missing <= got:
                missing_ok += 1
        if row.get("notes") and "hallucinated" in row["notes"]:
            quality_n += 1
            fake = Fact(
                key="secret",
                value="bịa",
                source_type="student_message",
                source_id="msg_does_not_exist",
                verification_status="unverified",
            )
            clean, warnings = sanitize_facts([*facts, fake], registry, demo_profile=True)
            if all(fact.source_id != "msg_does_not_exist" for fact in clean) and warnings:
                quality_fail_injection += 1
        if row.get("existing_officer_draft"):
            draft_warning_n += 1
            brief = OfficerBrief(
                ticket_id=snapshot.ticket.id,
                source_ticket_revision=snapshot.source_ticket_revision,
                summary=snapshot.ticket.summary[:2000],
                facts=facts,
                missing_items=[],
                checklist=checklist_for(snapshot),
                suggested_priority=suggested,
                priority_reasons=reasons if suggested == "high" else [],
                draft_reply="Bộ phận phụ trách sẽ kiểm tra hồ sơ.",
                citations=[],
                warnings=[],
                quality_status="pass",
            )
            guarded = guard_officer_brief(snapshot, brief, registry)
            if any(item.code == "existing_officer_draft" for item in guarded.warnings):
                draft_warning_ok += 1
    n = len(selected) or 1
    return {
        "n": len(selected),
        "provenance_validity": provenance_ok / n,
        "priority_accuracy": (priority_ok / priority_n) if priority_n else 0.0,
        "priority_n": priority_n,
        "missing_field_recall": (missing_ok / missing_n) if missing_n else 0.0,
        "source_injection_stripped": (quality_fail_injection / quality_n) if quality_n else 0.0,
        "existing_draft_warned": (draft_warning_ok / draft_warning_n) if draft_warning_n else 0.0,
        "scorer": "deterministic-guards",
    }


def _percentile(values: list[float], pct: float) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    idx = min(len(ordered) - 1, max(0, round((pct / 100) * (len(ordered) - 1))))
    return ordered[idx]


def _limits(live: bool) -> list[str]:
    lines = [
        "Do not claim 100% safety from this sample.",
        "Report model, prompt version, dataset version, n, and number of runs.",
    ]
    if live:
        lines.append("Live metrics come from CampusAgent with the configured provider.")
        lines.append("L1 still uses the injected RagPort (StubRag unless swapped).")
    else:
        lines.append("Default eval scores deterministic routing, L2 field heuristics, and L3 guards.")
        lines.append("It does not call a live LLM.")
    return lines


def deterministic_report(rows: list[dict], split: str | None) -> dict:
    return {
        "dataset_version": DATASET_VERSION,
        "prompt_versions": PROMPT_VERSIONS,
        "model": "rule-router+heuristics",
        "split": split or "all",
        "runs": 1,
        "metrics": {
            "routes": score_routes(rows, split),
            "l2_extraction": score_l2_fields(rows, split),
            "l2_outcome": score_l2_outcomes(rows, split),
            "l2_updates": score_l2_updates(rows, split),
            "l3_provenance_quality": score_l3(rows, split),
        },
        "limits": _limits(live=False),
    }


def _preview_contract(row: dict) -> Preview | None:
    fields = preview_fields(row)
    if fields is None:
        return None
    missing = [key for key, value in fields.model_dump().items() if value is None]
    return Preview(
        id="prv_eval",
        version=1,
        service_type="student_certificate",
        fields=fields,
        missing_fields=missing,
        invalid_fields=[],
        can_submit=not missing,
        expires_at=NOW,
    )


def _make_context(row: dict, request_id: str) -> IntakeContext:
    return IntakeContext(
        request_id=request_id,
        conversation_id="conv_eval",
        conversation_revision=1,
        actor=Actor(user_id="SV001", role="student"),
        student_profile=_profile(),
        message=Message(
            id=f"msg_{request_id}",
            conversation_id="conv_eval",
            ticket_id=None,
            sender="student",
            content=row["content"],
            created_at=NOW,
        ),
        history=[],
        preview=_preview_contract(row),
        linked_ticket=None,
        policy_scope="academic",
        effective_at=NOW,
    )


async def _run_live(rows: list[dict], split: str | None) -> dict:
    from campus247.agents.factory import create_agent
    from campus247.agents.stubs import StubRag
    from campus247.config import Settings
    from campus247.models.contracts_v1 import ModuleCallError
    from campus247.services.llm import LLMConfigurationError, create_chat_model, validate_llm_settings

    settings = Settings()
    if settings.agent_mode != "langgraph":
        raise LiveEvalRefused("AGENT_MODE must be langgraph to run --live.")
    try:
        validate_llm_settings(settings)
    except LLMConfigurationError as exc:
        raise LiveEvalRefused(str(exc)) from exc

    agent = create_agent(create_chat_model(settings), StubRag())
    latencies: list[float] = []
    errors = 0

    intake_rows = _split_rows(rows, split, {"L1", "L2", "L4"})
    route_correct = 0
    l4_fn = 0
    l1_fp = 0
    field_hits = 0
    field_total = 0
    outcome_ok = 0
    outcome_n = 0
    risk_ok = 0
    risk_n = 0
    update_hits = 0
    update_total = 0

    def _miss_live_row(row: dict) -> None:
        nonlocal field_total, outcome_n, risk_n, update_total
        if row["layer"] == "L2":
            field_total += len(gold_l2_field_values(row))
            update_total += len(row.get("expected_updates") or [])
            if row.get("expected_outcome"):
                outcome_n += 1
        if row.get("expected_risk"):
            risk_n += 1

    for row in intake_rows:
        started = time.monotonic()
        try:
            result = await agent.run_intake(_make_context(row, f"live_{row['id']}"))
        except ModuleCallError:
            errors += 1
            latencies.append(time.monotonic() - started)
            _miss_live_row(row)
            continue
        latencies.append(time.monotonic() - started)
        expected = row["expected_route"]
        if result.route == expected:
            route_correct += 1
        if expected == "L4" and result.route != "L4":
            l4_fn += 1
        if expected != "L1" and result.route == "L1":
            l1_fp += 1
        if row.get("expected_risk"):
            risk_n += 1
            got_risk = result.handover.risk_type if result.handover is not None else None
            if got_risk == row["expected_risk"]:
                risk_ok += 1
        if row["layer"] == "L2":
            dumped = result.intake.fields.model_dump() if result.intake is not None else {}
            for name, expected_value in gold_l2_field_values(row).items():
                field_total += 1
                if field_value_matches(
                    name,
                    dumped.get(name),
                    expected_value,
                    aliases=field_aliases_for(row, name),
                ):
                    field_hits += 1
            for name in row.get("expected_updates") or []:
                update_total += 1
                expected_value = gold_l2_field_values(row).get(name)
                if expected_value and field_value_matches(
                    name,
                    dumped.get(name),
                    expected_value,
                    aliases=field_aliases_for(row, name),
                ):
                    update_hits += 1
            if row.get("expected_outcome"):
                outcome_n += 1
                if result.outcome == row["expected_outcome"]:
                    outcome_ok += 1

    l3_rows = _split_rows(rows, split, {"L3"})
    provenance_ok = 0
    quality_fail = 0
    for row in l3_rows:
        snapshot = snapshot_from_row(row)
        started = time.monotonic()
        try:
            brief = await agent.prepare_officer_brief(snapshot)
        except ModuleCallError:
            errors += 1
            latencies.append(time.monotonic() - started)
            continue
        latencies.append(time.monotonic() - started)
        registry = source_registry_from_snapshot(snapshot)
        if all((fact.source_type, fact.source_id) in registry for fact in brief.facts):
            provenance_ok += 1
        if brief.quality_status == "fail":
            quality_fail += 1

    intake_n = len(intake_rows) or 1
    l3_n = len(l3_rows) or 1
    return {
        "dataset_version": DATASET_VERSION,
        "prompt_versions": PROMPT_VERSIONS,
        "model": settings.resolved_llm_model(),
        "provider": settings.llm_provider,
        "split": split or "all",
        "runs": 1,
        "metrics": {
            "routes": {
                "n": len(intake_rows),
                "route_accuracy": route_correct / intake_n,
                "l4_false_negative": l4_fn,
                "l1_false_positive_from_other": l1_fp,
                "risk_type_accuracy": (risk_ok / risk_n) if risk_n else 0.0,
                "risk_type_n": risk_n,
            },
            "l2_extraction": {
                "n": sum(1 for row in intake_rows if row["layer"] == "L2" and gold_l2_field_values(row)),
                "field_extraction_accuracy": (field_hits / field_total) if field_total else 0.0,
                "gold_fields": field_total,
                "extractor": "campus-agent",
                "match": "normalized-value",
            },
            "l2_outcome": {
                "n": outcome_n,
                "outcome_accuracy": (outcome_ok / outcome_n) if outcome_n else 0.0,
                "scorer": "campus-agent",
            },
            "l2_updates": {
                "n": sum(1 for row in intake_rows if row.get("expected_updates")),
                "update_accuracy": (update_hits / update_total) if update_total else 0.0,
                "gold_updates": update_total,
                "scorer": "campus-agent",
            },
            "l3_provenance_quality": {
                "n": len(l3_rows),
                "provenance_validity": provenance_ok / l3_n,
                "quality_status_fail_rate": quality_fail / l3_n,
                "scorer": "campus-agent",
            },
            "latency_seconds": {
                "n": len(latencies),
                "p50": _percentile(latencies, 50),
                "p95": _percentile(latencies, 95),
            },
            "provider_errors": errors,
            "tokens": None,
        },
        "limits": _limits(live=True),
    }


class LiveEvalRefused(RuntimeError):
    """--live was requested without a configured langgraph provider."""


def main() -> int:
    parser = argparse.ArgumentParser(description="Evaluate CampusAgent fixtures")
    parser.add_argument("--split", choices=["tune", "holdout"], default=None)
    parser.add_argument(
        "--live",
        action="store_true",
        help="Run CampusAgent with the configured provider. Refuses unless AGENT_MODE=langgraph.",
    )
    args = parser.parse_args()
    rows = load_rows()
    if args.live:
        try:
            report = asyncio.run(_run_live(rows, args.split))
        except LiveEvalRefused as exc:
            print(f"Refusing --live: {exc}", file=sys.stderr)
            print("Set AGENT_MODE=langgraph and valid LLM_* credentials to score a real model.", file=sys.stderr)
            return 2
        print(json.dumps(report, ensure_ascii=False, indent=2))
        return 0
    print(json.dumps(deterministic_report(rows, args.split), ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
