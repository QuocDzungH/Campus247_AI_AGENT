#!/usr/bin/env python3
"""RAG Evaluation Runner for Campus 24/7.

Evaluates hybrid retrieval, citation validity/support, and abstention on VinUni policy Markdown.
Supports:
- Offline mode (default): BM25 + deterministic ranking over real 422 processed Markdown chunks.
- Live mode (--live): Real Gemini embeddings + BM25 + RRF via production PipelineRag.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
import time
from collections import Counter
from datetime import UTC, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend" / "src"))

from campus247.config import Settings  # noqa: E402
from campus247.models.contracts_v1 import RagRequest, RetrievalRequest  # noqa: E402
from campus247.rag.embeddings import FakeEmbeddingProvider  # noqa: E402
from campus247.rag.factory import create_rag  # noqa: E402
from campus247.rag.pipeline import PipelineRag, _load_markdown_chunks  # noqa: E402
from campus247.rag.query import IdentityQueryNormalizer  # noqa: E402

DATASET_PATH = Path(__file__).with_name("dataset.jsonl")
PROCESSED_DATA_DIR = ROOT / "RAG" / "data" / "processed"


def load_dataset() -> list[dict]:
    if not DATASET_PATH.exists():
        raise FileNotFoundError(f"Dataset not found at {DATASET_PATH}")
    rows = []
    for line in DATASET_PATH.read_text(encoding="utf-8").splitlines():
        if line.strip():
            rows.append(json.loads(line))
    return rows


def _compute_retrieval_metrics(
    retrieved_chunk_ids: list[str],
    retrieved_doc_ids: list[str],
    relevant_chunk_ids: list[str],
    relevant_doc_ids: list[str],
    k_values: list[int] = [3, 5],
) -> dict:
    metrics = {}
    rel_docs = set(relevant_doc_ids)

    for k in k_values:
        top_k_docs = retrieved_doc_ids[:k]
        hits = sum(1 for d in top_k_docs if d in rel_docs)
        recall = 1.0 if hits > 0 else 0.0  # at document level
        precision = (hits / k) if k > 0 else 0.0
        metrics[f"recall@{k}"] = recall
        metrics[f"precision@{k}"] = precision

    # MRR calculation
    mrr = 0.0
    for idx, d in enumerate(retrieved_doc_ids, start=1):
        if d in rel_docs:
            mrr = 1.0 / idx
            break
    metrics["mrr"] = mrr

    return metrics


async def evaluate_scenarios(
    scenarios: list[dict],
    rag_instance: PipelineRag,
    is_live: bool,
    top_k: int = 5,
) -> dict:
    total = len(scenarios)
    in_domain_cases = [s for s in scenarios if s.get("scenario_group") == "in_domain"]
    ood_cases = [s for s in scenarios if s.get("scenario_group") == "out_of_domain"]
    # Metrics aggregates
    in_domain_total = len(in_domain_cases)
    ood_total = len(ood_cases)

    mrr_sum = 0.0
    recall_at_3_sum = 0.0
    recall_at_5_sum = 0.0
    prec_at_5_sum = 0.0

    false_abstentions = 0
    correct_abstentions = 0

    valid_citations = supported_citations = total_citations = 0
    execution_errors = 0

    latencies: list[float] = []
    case_results: list[dict] = []

    for row in scenarios:
        query = row["query"]
        group = row.get("scenario_group")
        expected_status = row.get("expected_status", "answered")
        rel_chunk_ids = row.get("relevant_chunk_ids", [])
        rel_doc_ids = row.get("relevant_document_ids", [])

        req = RetrievalRequest(
            query=query,
            policy_scope="academic" if group == "in_domain" else "demo_academic",
            top_k=min(top_k, 5),
            effective_at=datetime(2026, 9, 29, 8, 0, tzinfo=UTC),
        )

        t0 = time.perf_counter()
        try:
            res = await rag_instance.retrieve_policy(req)
            answer = await rag_instance.answer_question(
                RagRequest(
                    question=query,
                    history=[],
                    policy_scope=req.policy_scope,
                    effective_at=req.effective_at,
                )
            )
            elapsed = time.perf_counter() - t0
            latencies.append(elapsed)

            retrieved_chunk_ids = [p.citation.chunk_id for p in res.passages]
            retrieved_doc_ids = [p.citation.document_id for p in res.passages]
            status = "found" if res.passages else "empty"

            # In-domain evaluation
            if group == "in_domain":
                if status != "empty":
                    k_metrics = _compute_retrieval_metrics(
                        retrieved_chunk_ids, retrieved_doc_ids, rel_chunk_ids, rel_doc_ids
                    )
                    mrr_sum += k_metrics["mrr"]
                    recall_at_3_sum += k_metrics["recall@3"]
                    recall_at_5_sum += k_metrics["recall@5"]
                    prec_at_5_sum += k_metrics["precision@5"]

                # Citation validity means the cited chunk exists. Support is stricter:
                # the citation must be one of the case's evidence chunks.
                for citation in answer.citations:
                    total_citations += 1
                    if rag_instance.chunk_text(citation.chunk_id) is not None:
                        valid_citations += 1
                    if citation.chunk_id in rel_chunk_ids:
                        supported_citations += 1

                if answer.status != "answered":
                    false_abstentions += 1

            # Out-of-domain evaluation
            elif group == "out_of_domain":
                if answer.status == "insufficient_evidence":
                    correct_abstentions += 1

            case_results.append({
                "id": row["id"],
                "group": group,
                "query": query,
                "expected_status": expected_status,
                "actual_retrieval_status": status,
                "actual_answer_status": answer.status,
                "retrieved_passages_count": len(res.passages),
                "top_passage_doc": retrieved_doc_ids[0] if retrieved_doc_ids else None,
            })

        except Exception as exc:
            execution_errors += 1
            elapsed = time.perf_counter() - t0
            latencies.append(elapsed)
            case_results.append({
                "id": row["id"],
                "group": group,
                "query": query,
                "error": str(exc),
            })

    # Summary metrics
    n_in = in_domain_total or 1
    n_ood = ood_total or 1
    n_cit = total_citations or 1

    report = {
        "dataset_version": "rag-eval-v1",
        "index_version": getattr(rag_instance, "index_version", "unknown"),
        "mode": "live-pipeline" if is_live else "offline-pipeline-fake-embedding+bm25",
        "timestamp": datetime.now(UTC).isoformat(),
        "total_cases": total,
        "splits_count": Counter(s["split"] for s in scenarios),
        "groups_count": Counter(s["scenario_group"] for s in scenarios),
        "execution_errors": execution_errors,
        "metrics": {
            "retrieval": {
                "in_domain_n": in_domain_total,
                "recall@3": recall_at_3_sum / n_in,
                "recall@5": recall_at_5_sum / n_in,
                "precision@5": prec_at_5_sum / n_in,
                "mrr": mrr_sum / n_in,
            },
            "citations": {
                "total_citations_evaluated": total_citations,
                "citation_validity_rate": valid_citations / n_cit,
                "citation_support_rate": supported_citations / n_cit,
                "citation_support_n": total_citations,
            },
            "abstention_safety": {
                "ood_total": ood_total,
                "ood_abstention_accuracy": correct_abstentions / n_ood,
                "in_domain_total": in_domain_total,
                "false_abstention_rate": false_abstentions / n_in,
            },
            "latency": {
                "p50_seconds": sorted(latencies)[len(latencies) // 2] if latencies else None,
                "p95_seconds": sorted(latencies)[int(len(latencies) * 0.95)] if latencies else None,
                "mean_seconds": (sum(latencies) / len(latencies)) if latencies else None,
            },
        },
        "limits": [
            "Offline mode uses the production PipelineRag with deterministic hashed embeddings, BM25, and RRF.",
            "Semantic dense retrieval requires live Gemini API key and GEMINI_EMBEDDING_MODEL.",
            "Abstention is scored from RagPort.answer_question(), never from an RRF score threshold.",
        ],
    }
    return report


def format_rag_markdown(report: dict) -> str:
    m = report["metrics"]
    ret = m["retrieval"]
    cit = m["citations"]
    abs_m = m["abstention_safety"]
    lat = m["latency"]

    md = f"""# Campus 24/7 — RAG Evaluation Report

- **Dataset Version**: `{report['dataset_version']}`
- **RAG Mode**: `{report['mode']}`
- **Index Version**: `{report['index_version']}`
- **Total Scenarios**: `{report['total_cases']}`
- **Timestamp**: `{report['timestamp']}`

## 1. Retrieval Performance (In-Domain, N = {ret['in_domain_n']})
- **Recall@3**: `{ret['recall@3']:.2%}`
- **Recall@5**: `{ret['recall@5']:.2%}`
- **Precision@5**: `{ret['precision@5']:.2%}`
- **MRR (Mean Reciprocal Rank)**: `{ret['mrr']:.4f}`

## 2. Citation Integrity
- **Total Citations Evaluated**: `{cit['total_citations_evaluated']}`
- **Citation Validity Rate**: `{cit['citation_validity_rate']:.2%}` (Trích dẫn tồn tại trong index)
- **Citation Support Rate**: `{cit['citation_support_rate']:.2%}` (Trích dẫn đúng tài liệu liên quan)

## 3. Abstention & Anti-Hallucination (OOD Guard)
- **OOD Abstention Accuracy**: `{abs_m['ood_abstention_accuracy']:.2%}` (N = {abs_m['ood_total']})
  *(Khả năng nhận biết câu hỏi ngoài phạm vi và từ chối bịa đặt)*
- **False Abstention Rate**: `{abs_m['false_abstention_rate']:.2%}` (N = {abs_m['in_domain_total']})
  *(Tỷ lệ từ chối nhầm các câu hỏi có trong tài liệu)*

## 4. Latency
- **p50 Latency**: `{lat['p50_seconds'] * 1000:.1f} ms`
- **p95 Latency**: `{lat['p95_seconds'] * 1000:.1f} ms`
- **Mean Latency**: `{lat['mean_seconds'] * 1000:.1f} ms`
"""
    return md


async def async_main():
    parser = argparse.ArgumentParser(description="Evaluate Campus 24/7 RAG pipeline")
    parser.add_argument("--split", choices=["tune", "holdout"], help="Filter by split")
    parser.add_argument("--live", action="store_true", help="Run with live Gemini embedding provider")
    parser.add_argument("--out-json", type=str, help="Save report to JSON file path")
    parser.add_argument("--out-md", type=str, help="Save report to Markdown file path")
    args = parser.parse_args()

    scenarios = load_dataset()
    if args.split:
        scenarios = [s for s in scenarios if s.get("split") == args.split]

    settings = Settings()

    if args.live:
        # Check API key
        key = settings.google_api_key or settings.gemini_api_key
        if not key:
            print("Blocked: --live requires GOOGLE_API_KEY or GEMINI_API_KEY environment variable.", file=sys.stderr)
            sys.exit(2)
        settings.rag_mode = "pipeline"
        rag_instance = create_rag(settings)
    else:
        # Offline mode: Build PipelineRag using FakeEmbeddingProvider and real processed markdown chunks
        chunks = _load_markdown_chunks(PROCESSED_DATA_DIR)
        rag_instance = PipelineRag(
            PROCESSED_DATA_DIR,
            chunks=chunks,
            embedding_provider=FakeEmbeddingProvider(),
            query_normalizer=IdentityQueryNormalizer(),
            semantic_top_k=8,
            bm25_top_k=8,
            fusion_top_k=5,
        )

    report = await evaluate_scenarios(scenarios, rag_instance, is_live=args.live)

    if args.out_json:
        p = Path(args.out_json)
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")

    if args.out_md:
        p = Path(args.out_md)
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(format_rag_markdown(report), encoding="utf-8")

    print(json.dumps(report, indent=2, ensure_ascii=False))


def main():
    asyncio.run(async_main())


if __name__ == "__main__":
    main()
