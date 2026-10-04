"""Compose RagPort from settings. Stub remains the CI default.

Hybrid pipeline mode requires Gemini embeddings and query normalization outside tests.
Missing keys fail closed at process start; they do not fall back to StubAgent or BM25-only.
"""

from pathlib import Path

from campus247.agents.stubs import StubRag
from campus247.config import Settings
from campus247.models.ports_v1 import RagPort
from campus247.rag.corpus import CorpusRag
from campus247.rag.embeddings import (
    EmbeddingProvider,
    FakeEmbeddingProvider,
    GeminiEmbeddingProvider,
    RAGConfigurationError,
)
from campus247.rag.pipeline import PipelineRag
from campus247.rag.query import GeminiQueryNormalizer, IdentityQueryNormalizer, QueryNormalizer


def create_rag(
    settings: Settings,
    *,
    embedding_provider: EmbeddingProvider | None = None,
    query_normalizer: QueryNormalizer | None = None,
) -> RagPort:
    if settings.rag_mode == "corpus":
        return CorpusRag.from_packaged()
    if settings.rag_mode == "official":
        return CorpusRag.from_official()
    if settings.rag_mode == "pipeline":
        return _create_pipeline_rag(
            settings,
            embedding_provider=embedding_provider,
            query_normalizer=query_normalizer,
        )
    return StubRag()


def _create_pipeline_rag(
    settings: Settings,
    *,
    embedding_provider: EmbeddingProvider | None,
    query_normalizer: QueryNormalizer | None,
) -> PipelineRag:
    embedder = embedding_provider or embedding_provider_from_settings(settings)
    normalizer = query_normalizer or query_normalizer_from_settings(settings)
    return PipelineRag.from_directory(
        _resolve_pipeline_dir(settings.rag_pipeline_dir),
        embedding_provider=embedder,
        query_normalizer=normalizer,
        index_dir=_resolve_index_dir(settings.rag_index_dir),
        semantic_top_k=settings.rag_semantic_top_k,
        bm25_top_k=settings.rag_bm25_top_k,
        fusion_top_k=settings.rag_fusion_top_k,
    )


def embedding_provider_from_settings(settings: Settings) -> EmbeddingProvider:
    if settings.app_env == "test":
        return FakeEmbeddingProvider()
    from campus247.services.llm import google_api_key

    key = google_api_key(settings)
    if not key:
        raise RAGConfigurationError(
            "GOOGLE_API_KEY (or GEMINI_API_KEY) is required for RAG_MODE=pipeline hybrid retrieval."
        )
    return GeminiEmbeddingProvider(api_key=key, model=settings.gemini_embedding_model)


def query_normalizer_from_settings(settings: Settings) -> QueryNormalizer:
    if settings.app_env == "test":
        return IdentityQueryNormalizer()
    from campus247.services.llm import create_chat_model

    return GeminiQueryNormalizer(create_chat_model(settings))


def _resolve_pipeline_dir(value: str) -> Path:
    """Support launching Uvicorn from either the repository root or ``backend/``.

    Docker places RAG at ``/app/RAG`` and starts from ``/app``. Local developers
    commonly start Uvicorn from ``backend/``; in that case fall back to the
    repository's checked-in RAG directory.
    """
    configured = Path(value)
    if configured.is_absolute() or configured.exists():
        return configured
    return Path(__file__).resolve().parents[4] / configured


def _resolve_index_dir(value: str) -> Path:
    configured = Path(value)
    if configured.is_absolute():
        return configured
    cwd_path = (Path.cwd() / configured).resolve()
    return cwd_path
