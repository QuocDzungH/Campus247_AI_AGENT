# Agent evaluation and handoff

Dataset version: `agent-eval-v3`. Prompt versions live in `campus247.agents.prompts.PROMPT_VERSIONS`.

## What this module owns

`CampusAgent` implements `AgentPort`:

- `run_intake(IntakeContext) -> IntakeResult`
- `prepare_officer_brief(TicketSnapshot) -> OfficerBrief`

Backend (`student.py`, `jobs.py`) already calls those methods via `get_agent()`. This module does not write tickets, send student receipts, or resolve work.

## Config

| Variable | Meaning |
|---|---|
| `AGENT_MODE` | `stub` (default, tests) or `langgraph` |
| `LLM_PROVIDER` | `openai` \| `google` \| `groq` \| `openai_compatible` |
| `LLM_MODEL` | Canonical model name |
| `OPENAI_API_KEY` / `GOOGLE_API_KEY` / `GEMINI_API_KEY` / `GROQ_API_KEY` / `OPENAI_BASE_URL` | Provider credentials. `openai_base_url` is only used for `openai_compatible`. |

`services/llm.py` is the only provider factory. `agents/factory.py` composes graphs. Nodes do not call `get_settings()` or create clients.

Tests never need a real API key. Importing the app in `AGENT_MODE=stub` does not open a network client.

## Run eval

From the repo root:

```bash
PYTHONPATH=backend/src .venv/bin/python eval/agent/run_eval.py
PYTHONPATH=backend/src .venv/bin/python eval/agent/run_eval.py --split holdout
```

The default runner is deterministic and does **not** call a provider. It reports:

- route accuracy, L4 false negative, L1 false positive, and L4 `risk_type` accuracy (rule safety/intent router)
- L2 field-extraction accuracy against `expected_field_values` (exact match after normalize: lowercase, collapse space, strip trailing punctuation). Optional `field_aliases` on a row, e.g. `{"purpose": ["vay vốn NHCSXH"]}`, lists extra accepted strings for that field. Substring overlap is not a hit.
- L2 `collecting`/`preview_ready` outcome accuracy, including follow-up turns with `preview`
- L2 multi-turn `expected_updates` accuracy when a later message revises a field
- L3 provenance validity, priority floor, missing-field recall, source-injection strip, existing-draft warning

`split=tune` is for prompt/rule iteration. `split=holdout` is the reserved check set. Do not report “100% an toàn” from this sample.

`--live` builds `CampusAgent` from `AGENT_MODE=langgraph` and the configured LLM provider, then scores the same fixtures (route, L4 `risk_type`, L2 field values, multi-turn updates, outcome, L3 provenance/quality, p50/p95 latency, provider errors). Follow-up rows send the listed `preview`. Missing L2 `intake` still counts against field accuracy. The report uses `settings.resolved_llm_model()`, not a placeholder name.

If `AGENT_MODE` is not `langgraph` or LLM settings do not validate, `--live` prints an error to stderr and exits `2` without writing a live report. That job is manual; it is not part of the pytest regression suite.

## RAG handoff

When a real `RagPort` exists:

1. Implement `RagPort` (`retrieve_policy`, `answer_question`).
2. Inject it at the composition root: `set_rag(...)` then `create_agent(model, get_rag())`.
3. Re-run L1 fixtures. L1 maps `RagResult.status` onto `IntakeResult` unchanged.
4. After backend supplies `approved_sources`, re-run OfficerBrief evidence cases.

Do not change L2/L4 routing or the L3 graph only to attach RAG. RAG errors must stay `ModuleCallError`; they must not be rewritten as `insufficient_evidence`.

## Backend handoff

Expected intake outcomes:

- L1: `answered` / `needs_clarification` / `insufficient_evidence` with a student reply
- L2: `collecting` or `preview_ready` with `intake`; never a ticket code
- L4: `handover_required`, `reply=null`, `handover` packet; backend commits lock/ticket and then tells the student

Officer brief: facts with provenance, checklist `checked=false`, `suggested_priority=high` only with reasons, draft for internal review. `quality_status=fail` means do not send the draft as-is.

Timeouts: intake 25s total, 10s per provider call, one transient retry; officer brief 60s per job attempt (worker retries).
