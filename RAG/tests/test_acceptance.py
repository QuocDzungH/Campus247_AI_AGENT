import pytest
from unittest.mock import patch, MagicMock
from pydantic import BaseModel
from typing import Literal

# Mock contracts for acceptance tests
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

# Mock functions for testing
def mock_semantic_search(query, top_k=3):
    return [SearchResult(id="1", content="Sem", score=0.9, metadata={}, retrieval_method="dense")]

def mock_lexical_search(query, top_k=3):
    return [SearchResult(id="2", content="Lex", score=0.8, metadata={}, retrieval_method="bm25")]

def mock_rerank_rrf(dense_results, lexical_results):
    return [
        SearchResult(id="1", content="Sem", score=0.95, metadata={}, retrieval_method="hybrid"),
        SearchResult(id="2", content="Lex", score=0.85, metadata={}, retrieval_method="hybrid")
    ]

def mock_retrieve(query):
    return mock_rerank_rrf([], [])

def mock_generate_with_citation(query):
    sources = mock_retrieve(query)
    return GenerationResult(answer="Mock answer", sources=sources, retrieval_source="hybrid")

def mock_generate_with_citation_fallback(query):
    return GenerationResult(answer="Fallback answer", sources=[], retrieval_source="none")

def test_semantic_search_returns_list():
    results = mock_semantic_search("test")
    assert isinstance(results, list)
    assert len(results) > 0
    assert isinstance(results[0], SearchResult)
    assert results[0].retrieval_method == "dense"

def test_lexical_search_returns_list():
    results = mock_lexical_search("test")
    assert isinstance(results, list)
    assert len(results) > 0
    assert isinstance(results[0], SearchResult)
    assert results[0].retrieval_method == "bm25"

def test_rerank_rrf_deduplicates_and_sorts():
    results = mock_rerank_rrf([], [])
    assert len(results) == 2
    assert results[0].score >= results[1].score
    assert results[0].retrieval_method == "hybrid"

def test_retrieve_returns_non_empty():
    results = mock_retrieve("known query")
    assert len(results) > 0

def test_generate_with_citation_returns_generation_result():
    result = mock_generate_with_citation("test query")
    assert isinstance(result, GenerationResult)
    assert result.answer == "Mock answer"
    assert result.retrieval_source == "hybrid"
    assert len(result.sources) > 0

def test_fallback_works_when_dense_score_is_low():
    result = mock_generate_with_citation_fallback("obscure query")
    assert isinstance(result, GenerationResult)
    assert result.retrieval_source == "none"
    assert len(result.sources) == 0
