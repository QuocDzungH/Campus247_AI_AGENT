"""Embedding providers for hybrid RAG. Gemini is online; tests inject FakeEmbeddingProvider.

No local models, Chroma, or FAISS. The VectorIndexStore protocol is the persistence
seam so a later pgvector backend can replace the file cache without changing L1/L3.
"""

from __future__ import annotations

import hashlib
import logging
from typing import Protocol, runtime_checkable

import numpy as np

from campus247.rag.lexical import content_tokens

logger = logging.getLogger("campus247.rag")

FAKE_EMBEDDING_MODEL = "fake-hash-v1"
FAKE_EMBEDDING_DIM = 256


class RAGConfigurationError(ValueError):
    """Raised when hybrid RAG cannot be constructed (missing key, bad provider)."""


@runtime_checkable
class EmbeddingProvider(Protocol):
    model_name: str

    def embed_documents(self, texts: list[str]) -> list[list[float]]: ...

    def embed_query(self, text: str) -> list[float]: ...


class FakeEmbeddingProvider:
    """Deterministic hashed bag-of-tokens embeddings. No network.

    Used in tests and APP_ENV=test. Character 3-grams give light typo overlap in the
    same language; they do not translate Vietnamese to English — that is the query
    normalizer's job (Gemini in production, a scripted fake in tests).
    """

    def __init__(self, *, dimension: int = FAKE_EMBEDDING_DIM) -> None:
        self.model_name = FAKE_EMBEDDING_MODEL
        self.dimension = dimension
        self.document_calls = 0
        self.query_calls = 0
        self.embedded_texts: list[str] = []

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        self.document_calls += 1
        self.embedded_texts.extend(texts)
        return [hashed_embedding(text, self.dimension) for text in texts]

    def embed_query(self, text: str) -> list[float]:
        self.query_calls += 1
        return hashed_embedding(text, self.dimension)


class GeminiEmbeddingProvider:
    """Online Gemini embeddings. API key comes from settings, never hard-coded."""

    def __init__(self, *, api_key: str, model: str, batch_size: int = 32) -> None:
        if not api_key.strip():
            raise RAGConfigurationError("GOOGLE_API_KEY (or GEMINI_API_KEY) is required for hybrid RAG embeddings.")
        if not model.strip():
            raise RAGConfigurationError("GEMINI_EMBEDDING_MODEL is required for hybrid RAG embeddings.")
        from langchain_google_genai import GoogleGenerativeAIEmbeddings

        self.model_name = model.strip()
        self._batch_size = max(1, batch_size)
        self._client = GoogleGenerativeAIEmbeddings(
            model=self.model_name,
            google_api_key=api_key.strip(),
        )

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        import time

        vectors: list[list[float]] = []
        for start in range(0, len(texts), self._batch_size):
            batch = texts[start : start + self._batch_size]
            for attempt in range(6):
                try:
                    res = self._client.embed_documents(batch)
                    vectors.extend(res)
                    logger.info("embedded_batch %d/%d chunks", len(vectors), len(texts))
                    break
                except Exception as exc:
                    if ("429" in str(exc) or "RESOURCE_EXHAUSTED" in str(exc)) and attempt < 5:
                        logger.warning("gemini_embedding_rate_limit retry_in_45s attempt=%d", attempt + 1)
                        time.sleep(45)
                    else:
                        raise
            if start + self._batch_size < len(texts):
                time.sleep(0.5)
        return vectors

    def embed_query(self, text: str) -> list[float]:
        return self._client.embed_query(text)


def hashed_embedding(text: str, dimension: int = FAKE_EMBEDDING_DIM) -> list[float]:
    vector = np.zeros(dimension, dtype=np.float32)
    tokens = content_tokens(text)
    for token in tokens:
        _accumulate(vector, f"t:{token}", 1.0)
        if len(token) >= 3:
            for index in range(len(token) - 2):
                _accumulate(vector, f"g:{token[index : index + 3]}", 0.4)
    compact = "".join(tokens)
    for index in range(max(0, len(compact) - 2)):
        _accumulate(vector, f"c:{compact[index : index + 3]}", 0.25)
    norm = float(np.linalg.norm(vector))
    if norm == 0.0:
        return vector.tolist()
    return (vector / norm).tolist()


def _accumulate(vector: np.ndarray, key: str, weight: float) -> None:
    digest = hashlib.sha256(key.encode("utf-8")).digest()
    index = int.from_bytes(digest[:4], "little") % vector.shape[0]
    sign = 1.0 if digest[4] % 2 == 0 else -1.0
    vector[index] += sign * weight
