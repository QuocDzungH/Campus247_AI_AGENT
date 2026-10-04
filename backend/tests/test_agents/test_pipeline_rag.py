from datetime import UTC, datetime

import pytest

from campus247.agents.factory import create_agent
from campus247.agents.state import GroundedL1Answer
from campus247.models.contracts_v1 import ModuleCallError, RagRequest, RetrievalRequest
from campus247.rag.pipeline import PipelineRag
from campus247.rag.query import ScriptedQueryNormalizer
from tests.test_agents.fakes import ScriptedChatModel
from tests.test_agents.helpers import make_context

NOW = datetime(2026, 10, 3, tzinfo=UTC)


def _write_source(tmp_path):
    source_dir = tmp_path / "data" / "processed"
    source_dir.mkdir(parents=True)
    (source_dir / "appeals.md").write_text(
        "---\n"
        'source: "academic_regulations"\n'
        'title: "Academic Regulations"\n'
        'url: "https://policy.vinuni.edu.vn/academic-regulations"\n'
        "---\n\n"
        "## Grade appeal\n"
        "Students may submit a grade appeal through the formal escalation procedure within the stated period. "
        "Thủ tục phúc khảo điểm được tiếp nhận theo quy trình escalation.\n",
        encoding="utf-8",
    )
    (source_dir / "transcripts.md").write_text(
        "---\n"
        'source: "request_transcripts"\n'
        'title: "Request Transcripts"\n'
        'url: "https://registrar.vinuni.edu.vn/transcripts"\n'
        "---\n\n"
        "## Request transcripts\n"
        "Students may request official transcripts from the Registrar.\n",
        encoding="utf-8",
    )


def test_pipeline_rag_strips_standalone_navigation_links(tmp_path):
    source_dir = tmp_path / "data" / "processed"
    source_dir.mkdir(parents=True)
    (source_dir / "requests.md").write_text(
        "---\nsource: requests\ntitle: Request service\n---\n\n"
        "- [Request service](https://example.test/request)\n"
        "[Request service](https://example.test/request)\n"
        "## How to request\n"
        "Submit the official request form, then wait for email confirmation.\n",
        encoding="utf-8",
    )

    rag = PipelineRag.from_directory(tmp_path)

    assert len(rag._chunks) == 1
    chunk = next(iter(rag._chunks.values()))
    assert "official request form" in chunk.text
    assert "https://example.test/request" not in chunk.text


@pytest.mark.asyncio
async def test_pipeline_rag_keeps_neighboring_chunk_for_procedure_context(tmp_path):
    source_dir = tmp_path / "data" / "processed"
    source_dir.mkdir(parents=True)
    (source_dir / "procedure.md").write_text(
        "---\nsource: procedure\ntitle: Procedure\n---\n\n"
        "## Overview\n"
        + ("procedure overview " * 90)
        + "\n## Steps\nSubmit the official form and wait for confirmation.\n",
        encoding="utf-8",
    )
    rag = PipelineRag.from_directory(tmp_path)

    result = await rag.retrieve_policy(_retrieval("procedure overview"))

    first, second = [item.citation.chunk_id for item in result.passages[:2]]
    assert first.startswith("procedure-c")
    assert second.startswith("procedure-c")
    assert abs(int(first.rsplit("c", 1)[1]) - int(second.rsplit("c", 1)[1])) == 1


def _retrieval(query: str, *, scope: str = "student_services") -> RetrievalRequest:
    return RetrievalRequest(query=query, policy_scope=scope, top_k=3, effective_at=NOW)


@pytest.mark.asyncio
async def test_pipeline_rag_builds_bm25_passages_from_markdown(tmp_path):
    _write_source(tmp_path)
    rag = PipelineRag.from_directory(tmp_path)
    result = await rag.retrieve_policy(_retrieval("How can I submit a grade appeal?"))

    assert result.status == "found"
    assert result.index_version.startswith("vinuni-hybrid-")
    citation = result.passages[0].citation
    assert citation.document_id == "academic_regulations"
    assert citation.quote in rag.chunk_text(citation.chunk_id)
    assert citation.url == "https://policy.vinuni.edu.vn/academic-regulations"


def _vietnamese_normalizer() -> ScriptedQueryNormalizer:
    """Stand-in for Gemini query understanding. Production does not use this mapping."""
    return ScriptedQueryNormalizer(
        {
            "Quy trình phúc khảo điểm như thế nào?": {
                "corrected": "Quy trình phúc khảo điểm như thế nào?",
                "retrieval_queries": ["grade appeal procedure", "Quy trình phúc khảo điểm như thế nào?"],
            },
            "Thủ tục xin bảng điểm như thế nào?": {
                "corrected": "Thủ tục xin bảng điểm như thế nào?",
                "retrieval_queries": ["request official transcripts procedure", "Thủ tục xin bảng điểm như thế nào?"],
            },
            "Có những giấy tờ nào có thể xin được?": {
                "corrected": "Có những giấy tờ nào có thể xin được?",
                "retrieval_queries": [
                    "What official documents transcripts and certifications can students request?",
                    "Có những giấy tờ nào có thể xin được?",
                ],
            },
        }
    )


@pytest.mark.asyncio
async def test_pipeline_rag_expands_vietnamese_service_terms(tmp_path):
    _write_source(tmp_path)
    rag = PipelineRag.from_directory(tmp_path, query_normalizer=_vietnamese_normalizer())
    result = await rag.retrieve_policy(_retrieval("Quy trình phúc khảo điểm như thế nào?"))

    assert result.status == "found"
    assert result.passages[0].citation.document_id == "academic_regulations"


@pytest.mark.asyncio
async def test_pipeline_rag_prioritizes_the_service_source_for_vietnamese_document_request(tmp_path):
    _write_source(tmp_path)
    rag = PipelineRag.from_directory(tmp_path, query_normalizer=_vietnamese_normalizer())
    result = await rag.retrieve_policy(_retrieval("Thủ tục xin bảng điểm như thế nào?"))

    assert result.status == "found"
    assert result.passages[0].citation.document_id == "request_transcripts"


@pytest.mark.asyncio
async def test_pipeline_rag_finds_requestable_documents_from_natural_vietnamese(tmp_path):
    _write_source(tmp_path)
    rag = PipelineRag.from_directory(tmp_path, query_normalizer=_vietnamese_normalizer())

    result = await rag.retrieve_policy(_retrieval("Có những giấy tờ nào có thể xin được?"))

    assert result.status == "found"
    assert result.passages[0].citation.document_id == "request_transcripts"


@pytest.mark.asyncio
async def test_pipeline_rag_returns_insufficient_evidence_for_unknown_question(tmp_path):
    _write_source(tmp_path)
    rag = PipelineRag.from_directory(tmp_path)
    result = await rag.answer_question(
        RagRequest(
            question="How do I order pizza on Mars?", history=[], policy_scope="student_services", effective_at=NOW
        )
    )
    assert result.status == "insufficient_evidence"
    assert result.citations == []


@pytest.mark.asyncio
async def test_pipeline_rag_l1_uses_model_only_after_retrieval_and_validates_citations(tmp_path):
    _write_source(tmp_path)
    rag = PipelineRag.from_directory(tmp_path)
    retrieved = await rag.retrieve_policy(_retrieval("Thủ tục phúc khảo điểm như thế nào?", scope="demo_academic"))
    model = ScriptedChatModel(
        {
            "GroundedL1Answer": {
                "outcome": "answered",
                "answer": "Bạn có thể nộp phúc khảo theo thủ tục escalation được nêu trong quy định.",
                "used_chunk_ids": [retrieved.passages[0].citation.chunk_id],
            }
        }
    )
    agent = create_agent(model, rag)

    result = await agent.run_intake(make_context("Thủ tục phúc khảo điểm như thế nào?"))

    assert result.route == "L1"
    assert result.outcome == "answered"
    assert result.citations[0].chunk_id == retrieved.passages[0].citation.chunk_id
    assert [name for name, _ in model.calls] == [GroundedL1Answer.__name__]


@pytest.mark.asyncio
async def test_pipeline_rag_l1_omits_citations_when_retrieval_is_not_relevant(tmp_path):
    _write_source(tmp_path)
    rag = PipelineRag.from_directory(tmp_path)
    model = ScriptedChatModel(
        {
            "GroundedL1Answer": {
                "outcome": "insufficient_evidence",
                "answer": "Tài liệu được cung cấp không có quy định về giấy miễn điểm danh.",
                "used_chunk_ids": [],
            }
        }
    )
    agent = create_agent(model, rag)

    result = await agent.run_intake(make_context("Quy trình xin giấy miễn điểm danh?"))

    assert result.outcome == "insufficient_evidence"
    assert result.citations == []


@pytest.mark.asyncio
async def test_pipeline_rag_denies_unknown_scope(tmp_path):
    _write_source(tmp_path)
    rag = PipelineRag.from_directory(tmp_path)
    with pytest.raises(ModuleCallError) as exc:
        await rag.retrieve_policy(_retrieval("grade appeal", scope="finance"))
    assert exc.value.error.code == "POLICY_SCOPE_DENIED"


@pytest.mark.asyncio
async def test_pipeline_rag_requires_markdown_sources(tmp_path):
    rag = PipelineRag.from_directory(tmp_path)
    with pytest.raises(ModuleCallError) as exc:
        await rag.retrieve_policy(_retrieval("grade appeal"))
    assert exc.value.error.code == "INDEX_UNAVAILABLE"
