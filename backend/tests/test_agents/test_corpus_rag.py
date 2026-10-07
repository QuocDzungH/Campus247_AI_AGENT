import subprocess
from datetime import UTC, datetime
from pathlib import Path

import pytest

from campus247.agents.factory import create_agent
from campus247.models.contracts_v1 import ModuleCallError, RagRequest, RetrievalRequest
from campus247.rag.corpus import CorpusRag
from tests.test_agents.fakes import ScriptedChatModel
from tests.test_agents.helpers import make_context

NOW = datetime(2026, 9, 29, 8, 0, tzinfo=UTC)
EXPIRED_AT = datetime(2020, 6, 1, tzinfo=UTC)


def _retrieval(query: str, *, scope: str = "demo_academic", effective_at=NOW) -> RetrievalRequest:
    return RetrievalRequest(query=query, policy_scope=scope, top_k=5, effective_at=effective_at)


def _rag_request(question: str, *, scope: str = "demo_academic") -> RagRequest:
    return RagRequest(question=question, history=[], policy_scope=scope, effective_at=NOW)


def test_packaged_corpus_is_tracked_and_not_gitignored():
    repo = Path(__file__).resolve().parents[3]
    relative = "backend/src/campus247/rag/data/demo_academic_v1.json"
    path = repo / relative
    assert path.is_file()
    tracked = subprocess.run(["git", "ls-files", "--error-unmatch", relative], cwd=repo, capture_output=True, text=True)
    assert tracked.returncode == 0, tracked.stderr
    check = subprocess.run(["git", "check-ignore", "-v", relative], cwd=repo, capture_output=True, text=True)
    if check.returncode == 0:
        assert "!" in check.stdout, check.stdout
    else:
        assert check.returncode == 1, check.stderr
    rag = CorpusRag.from_packaged()
    assert rag.index_version == "edu14-demo-academic-v1"
    assert rag.chunk_text("demo-qc-giay-001-c01")


@pytest.fixture
def rag() -> CorpusRag:
    return CorpusRag.from_packaged()


@pytest.mark.asyncio
async def test_packaged_corpus_returns_quote_from_chunk_text(rag: CorpusRag):
    result = await rag.retrieve_policy(_retrieval("Thủ tục phúc khảo điểm thế nào?"))
    assert result.status == "found"
    assert result.index_version == "edu14-demo-academic-v1"
    assert result.passages
    for passage in result.passages:
        source = rag.chunk_text(passage.citation.chunk_id)
        assert source is not None
        assert passage.citation.quote in source
        assert passage.text in source or source.startswith(passage.text[:20])
        assert "Demo" in passage.citation.document_title or "demo" in passage.citation.document_title.lower()


@pytest.mark.asyncio
async def test_academic_scope_alias_retrieves_demo_corpus(rag: CorpusRag):
    result = await rag.retrieve_policy(
        _retrieval("Quy trình cấp giấy xác nhận sinh viên như thế nào?", scope="academic")
    )
    assert result.status == "found"
    assert any("giấy xác nhận" in item.text.lower() for item in result.passages)


@pytest.mark.asyncio
async def test_unknown_query_is_empty_not_invented(rag: CorpusRag):
    result = await rag.retrieve_policy(_retrieval("Làm sao đặt pizza trên sao Hỏa với người máy?"))
    assert result.status == "empty"
    assert result.passages == []
    answered = await rag.answer_question(_rag_request("Làm sao đặt pizza trên sao Hỏa với người máy?"))
    assert answered.status == "insufficient_evidence"
    assert answered.citations == []


@pytest.mark.asyncio
async def test_unapproved_and_expired_chunks_are_excluded(rag: CorpusRag):
    live = await rag.retrieve_policy(_retrieval("học bổng bản nháp chưa duyệt"))
    assert all(item.citation.chunk_id != "demo-qc-unapproved-001-c01" for item in live.passages)
    expired = await rag.retrieve_policy(_retrieval("mức học phí demo năm 2020", effective_at=NOW))
    assert all(item.citation.chunk_id != "demo-qc-expired-001-c01" for item in expired.passages)
    historic = await rag.retrieve_policy(_retrieval("mức học phí demo năm 2020", effective_at=EXPIRED_AT))
    assert historic.status == "found"
    assert any(item.citation.chunk_id == "demo-qc-expired-001-c01" for item in historic.passages)


@pytest.mark.asyncio
async def test_policy_scope_denied_is_module_error(rag: CorpusRag):
    with pytest.raises(ModuleCallError) as exc:
        await rag.retrieve_policy(_retrieval("phúc khảo điểm", scope="finance"))
    assert exc.value.error.code == "POLICY_SCOPE_DENIED"
    assert exc.value.error.retryable is False


@pytest.mark.asyncio
async def test_corrupt_index_raises_unavailable_not_empty(tmp_path: Path):
    rag = CorpusRag.from_path(tmp_path / "missing.json")
    with pytest.raises(ModuleCallError) as exc:
        await rag.retrieve_policy(_retrieval("phúc khảo điểm"))
    assert exc.value.error.code == "INDEX_UNAVAILABLE"
    with pytest.raises(ModuleCallError) as exc:
        await rag.answer_question(_rag_request("phúc khảo điểm"))
    assert exc.value.error.code == "INDEX_UNAVAILABLE"


@pytest.mark.asyncio
async def test_l1_intake_uses_corpus_citations_without_llm(rag: CorpusRag):
    agent = create_agent(ScriptedChatModel({}), rag, index_version=rag.index_version)
    result = await agent.run_intake(make_context("Quy trình cấp giấy xác nhận sinh viên như thế nào?"))
    assert result.route == "L1"
    assert result.outcome == "answered"
    assert result.citations
    for citation in result.citations:
        source = rag.chunk_text(citation.chunk_id)
        assert source is not None
        assert citation.quote in source


@pytest.mark.asyncio
async def test_distinct_queries_hit_different_chunks(rag: CorpusRag):
    grade = await rag.retrieve_policy(_retrieval("Khiếu nại điểm nộp ở đâu?"))
    leave = await rag.retrieve_policy(_retrieval("Hướng dẫn quy định nghỉ học tạm thời ở đâu?"))
    assert grade.status == "found" and leave.status == "found"
    assert grade.passages[0].citation.chunk_id != leave.passages[0].citation.chunk_id
