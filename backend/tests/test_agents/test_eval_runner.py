import importlib.util
import json
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
EVAL = ROOT / "eval" / "agent" / "run_eval.py"


def _load_run_eval():
    spec = importlib.util.spec_from_file_location("agent_run_eval", EVAL)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _run_eval(*args: str, env: dict | None = None) -> subprocess.CompletedProcess[str]:
    merged = os.environ.copy()
    merged["PYTHONPATH"] = str(ROOT / "backend" / "src")
    if env:
        merged.update(env)
    return subprocess.run(
        [sys.executable, str(EVAL), *args],
        cwd=str(ROOT),
        capture_output=True,
        text=True,
        env=merged,
        check=False,
    )


def test_default_eval_reports_l2_and_l3_metrics():
    proc = _run_eval()
    assert proc.returncode == 0, proc.stderr
    report = json.loads(proc.stdout)
    assert report["model"] == "rule-router+heuristics"
    assert report["dataset_version"] == "agent-eval-v3"
    metrics = report["metrics"]
    assert "routes" in metrics
    assert "l2_extraction" in metrics
    assert "l2_outcome" in metrics
    assert "l3_provenance_quality" in metrics
    assert metrics["routes"]["risk_type_n"] > 0
    assert "risk_type_accuracy" in metrics["routes"]
    assert metrics["l2_extraction"]["field_extraction_accuracy"] > 0
    assert metrics["l2_extraction"]["match"] == "exact-normalized-or-alias"
    assert metrics["l2_outcome"]["n"] > 0
    assert "outcome_accuracy" in metrics["l2_outcome"]
    assert metrics["l2_updates"]["n"] == 3
    assert metrics["l2_updates"]["gold_updates"] == 3
    assert metrics["l3_provenance_quality"]["provenance_validity"] == 1.0
    assert "live-provider" not in proc.stdout


def test_live_eval_without_langgraph_exits_nonzero():
    proc = _run_eval("--live", env={"AGENT_MODE": "stub"})
    assert proc.returncode != 0
    assert "live-provider" not in proc.stdout
    assert "Refusing --live" in proc.stderr


def test_field_value_matches_requires_exact_or_declared_alias():
    eval_mod = _load_run_eval()
    matches = eval_mod.field_value_matches
    assert matches("purpose", "vay vốn ngân hàng", "vay vốn ngân hàng") is True
    assert matches("purpose", "Vay vốn ngân hàng.", "vay vốn ngân hàng") is True
    assert matches("purpose", "không vay vốn ngân hàng", "vay vốn ngân hàng") is False
    assert matches("destination_org", "không phải Sở Nội vụ", "Sở Nội vụ") is False
    assert matches("destination_org", "Sở Nội vụ Hà Nội", "Sở Nội vụ") is False
    assert matches("destination_org", "Sở Nội vụ", "Sở Nội vụ") is True
    assert (
        matches(
            "destination_org",
            "UBND quận",
            "Sở Nội vụ",
            aliases=["UBND quận"],
        )
        is True
    )
    assert (
        matches(
            "purpose",
            "không vay vốn ngân hàng",
            "vay vốn ngân hàng",
            aliases=["vay NH"],
        )
        is False
    )
