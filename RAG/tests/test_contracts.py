import pytest
from pydantic import BaseModel, ValidationError
from typing import Literal

# Local mock of contracts for testing standalone
class Document(BaseModel):
    id: str
    content: str
    metadata: dict

class SearchResult(BaseModel):
    id: str
    content: str
    score: float
    metadata: dict
    retrieval_method: Literal["dense", "bm25", "hybrid", "pageindex"]

class GenerationResult(BaseModel):
    answer: str
    sources: list[SearchResult]
    retrieval_source: Literal["hybrid", "pageindex", "none"]

def test_document_creation_valid():
    doc = Document(id="doc1", content="Test content", metadata={"type": "policy"})
    assert doc.id == "doc1"
    assert doc.content == "Test content"
    assert doc.metadata["type"] == "policy"

def test_document_creation_invalid():
    with pytest.raises(ValidationError):
        Document(id=123, content="Content") # Missing metadata, id wrong type

def test_search_result_creation_valid():
    sr = SearchResult(
        id="sr1",
        content="Result content",
        score=0.95,
        metadata={"source": "faq"},
        retrieval_method="dense"
    )
    assert sr.retrieval_method == "dense"
    assert sr.score == 0.95

def test_search_result_creation_invalid_method():
    with pytest.raises(ValidationError):
        SearchResult(
            id="sr2",
            content="Content",
            score=0.8,
            metadata={},
            retrieval_method="invalid_method" # Invalid literal
        )

def test_generation_result_creation():
    sr = SearchResult(id="1", content="C", score=0.9, metadata={}, retrieval_method="hybrid")
    gr = GenerationResult(
        answer="Hello",
        sources=[sr],
        retrieval_source="hybrid"
    )
    assert gr.answer == "Hello"
    assert len(gr.sources) == 1

def test_generation_result_invalid_source():
    with pytest.raises(ValidationError):
        GenerationResult(
            answer="Ans",
            sources=[],
            retrieval_source="invalid" # Invalid literal
        )

def test_search_result_unique_ids():
    sr1 = SearchResult(id="1", content="A", score=0.9, metadata={}, retrieval_method="dense")
    sr2 = SearchResult(id="2", content="B", score=0.8, metadata={}, retrieval_method="dense")
    sources = [sr1, sr2]
    ids = [s.id for s in sources]
    assert len(set(ids)) == len(ids)

def test_search_result_score_sorting():
    sr1 = SearchResult(id="1", content="A", score=0.8, metadata={}, retrieval_method="dense")
    sr2 = SearchResult(id="2", content="B", score=0.95, metadata={}, retrieval_method="dense")
    sources = sorted([sr1, sr2], key=lambda x: x.score, reverse=True)
    assert sources[0].id == "2"
    assert sources[1].id == "1"
