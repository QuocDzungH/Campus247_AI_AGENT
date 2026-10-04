"""Packaged demo academic corpus and RagPort implementations."""

from campus247.rag.corpus import CorpusRag
from campus247.rag.embeddings import FakeEmbeddingProvider, RAGConfigurationError
from campus247.rag.factory import create_rag
from campus247.rag.pipeline import PipelineRag

__all__ = ["CorpusRag", "FakeEmbeddingProvider", "PipelineRag", "RAGConfigurationError", "create_rag"]
