import asyncio
import importlib.util
from pathlib import Path

from campus247.models.contracts_v1 import Citation, Passage, RagResult, RetrievalResult

ROOT = Path(__file__).resolve().parents[3]
RAG_EVAL = ROOT / "eval" / "rag" / "run_rag_eval.py"


def _load_rag_eval():
    spec = importlib.util.spec_from_file_location("rag_eval", RAG_EVAL)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class _FoundButUngroundedRag:
    citation = Citation(
        document_id="unrelated",
        document_title="Unrelated",
        document_version="v1",
        chunk_id="unrelated-c1",
        locator="1",
        quote="unrelated text",
        url=None,
    )

    async def retrieve_policy(self, _request):
        return RetrievalResult(
            status="found",
            passages=[Passage(citation=self.citation, text="unrelated text", score=0.01)],
            index_version="test-index",
        )

    async def answer_question(self, _request):
        return RagResult(status="answered", answer="unrelated text", citations=[self.citation])

    def chunk_text(self, chunk_id):
        return "unrelated text" if chunk_id == self.citation.chunk_id else None


def test_ood_abstention_uses_answer_status_not_rrf_score():
    rag_eval = _load_rag_eval()
    report = asyncio.run(
        rag_eval.evaluate_scenarios(
            [
                {
                    "id": "ood",
                    "split": "holdout",
                    "scenario_group": "out_of_domain",
                    "query": "unrelated question",
                    "expected_status": "insufficient_evidence",
                    "relevant_document_ids": [],
                    "relevant_chunk_ids": [],
                }
            ],
            _FoundButUngroundedRag(),
            is_live=False,
        )
    )
    assert report["metrics"]["abstention_safety"]["ood_abstention_accuracy"] == 0.0
