"""Hybrid RAG over checked-in VinUni policy Markdown.

Semantic retrieval uses an injected EmbeddingProvider (Gemini online in production,
FakeEmbeddingProvider in tests). BM25 is a supplemental signal. Rankings are merged
with Reciprocal Rank Fusion. Query understanding is a Pydantic-normalized rewrite,
not a Vietnamese–English keyword dictionary.
"""

from __future__ import annotations

import hashlib
import logging
import re
from pathlib import Path

import numpy as np

from campus247.agents.errors import map_provider_error, module_error
from campus247.models.contracts_v1 import Citation, Passage, RagRequest, RagResult, RetrievalRequest, RetrievalResult
from campus247.rag.embeddings import EmbeddingProvider, FakeEmbeddingProvider
from campus247.rag.fusion import reciprocal_rank_fusion
from campus247.rag.lexical import IndexedChunk, LexicalIndex, content_tokens, quote_span
from campus247.rag.query import IdentityQueryNormalizer, NormalizedQuery, QueryNormalizer, retrieval_strings
from campus247.rag.store import CHUNKER_VERSION, FileVectorIndex, IndexSpec, VectorIndexStore
from campus247.services.common import MSG_L1_EMPTY

logger = logging.getLogger("campus247.rag")

_ALLOWED_SCOPES = frozenset({"demo_academic", "academic", "official", "student_services"})
_CHUNK_SIZE = 900
_CHUNK_OVERLAP = 180
_LINK_ONLY_LINE = re.compile(r"^\s*(?:[-*]\s*)?(?:\[[^\]]+\]\([^)]*\)\s*)+$")
_MIN_COSINE = 0.22
_MAX_PROMPT_PASSAGES = 5


class PipelineRag:
    """Hybrid RagPort: Gemini (or injected) embeddings + BM25 + RRF, cached by source hash.

    ``requires_grounded_generation`` tells L1 to invoke the chat model only after retrieval,
    with retrieved chunk IDs as a strict citation allowlist.
    """

    requires_grounded_generation = True

    def __init__(
        self,
        pipeline_dir: Path,
        *,
        chunks: list[IndexedChunk] | None = None,
        load_error: str | None = None,
        embedding_provider: EmbeddingProvider | None = None,
        query_normalizer: QueryNormalizer | None = None,
        vector_store: VectorIndexStore | None = None,
        source_hash: str = "",
        semantic_top_k: int = 8,
        bm25_top_k: int = 8,
        fusion_top_k: int = _MAX_PROMPT_PASSAGES,
        min_cosine: float = _MIN_COSINE,
    ) -> None:
        self.pipeline_dir = Path(pipeline_dir)
        self._load_error = load_error
        self._embedder = embedding_provider or FakeEmbeddingProvider()
        self._normalizer = query_normalizer or IdentityQueryNormalizer()
        self._store = vector_store
        self._source_hash = source_hash
        self._semantic_top_k = max(1, semantic_top_k)
        self._bm25_top_k = max(1, bm25_top_k)
        self._fusion_top_k = min(_MAX_PROMPT_PASSAGES, max(1, fusion_top_k))
        self._min_cosine = min_cosine
        self._chunks = {chunk.chunk_id: chunk for chunk in chunks or []}
        self._document_chunk_ids: dict[str, list[str]] = {}
        for chunk in self._chunks.values():
            self._document_chunk_ids.setdefault(chunk.document_id, []).append(chunk.chunk_id)
        self._index = LexicalIndex(list(self._chunks.values()))
        self._chunk_ids = tuple(sorted(self._chunks))
        self._matrix: np.ndarray | None = None
        if self._chunks:
            self.index_version = _index_version(
                source_hash=self._source_hash,
                embedding_model=self._embedder.model_name,
                chunk_count=len(self._chunk_ids),
            )
            self._matrix = self._load_or_embed()
        else:
            self.index_version = "vinuni-hybrid-unavailable"

    @classmethod
    def from_directory(
        cls,
        directory: Path,
        *,
        embedding_provider: EmbeddingProvider | None = None,
        query_normalizer: QueryNormalizer | None = None,
        index_dir: Path | None = None,
        vector_store: VectorIndexStore | None = None,
        semantic_top_k: int = 8,
        bm25_top_k: int = 8,
        fusion_top_k: int = _MAX_PROMPT_PASSAGES,
    ) -> PipelineRag:
        root = Path(directory)
        source_dir = root / "data" / "processed"
        store = vector_store
        if store is None and index_dir is not None:
            store = FileVectorIndex(Path(index_dir))
        try:
            chunks = _load_markdown_chunks(source_dir)
            if not chunks:
                raise ValueError("no Markdown chunks")
            return cls(
                root,
                chunks=chunks,
                embedding_provider=embedding_provider,
                query_normalizer=query_normalizer,
                vector_store=store,
                source_hash=_source_hash(source_dir),
                semantic_top_k=semantic_top_k,
                bm25_top_k=bm25_top_k,
                fusion_top_k=fusion_top_k,
            )
        except Exception as exc:  # Never report a source-load failure as an empty answer.
            logger.warning("pipeline_rag_unavailable path=%s type=%s", root, type(exc).__name__)
            return cls(
                root,
                load_error="markdown_load_failed",
                embedding_provider=embedding_provider,
                query_normalizer=query_normalizer,
                vector_store=store,
            )

    async def retrieve_policy(self, request: RetrievalRequest) -> RetrievalResult:
        if request.policy_scope not in _ALLOWED_SCOPES:
            raise module_error("POLICY_SCOPE_DENIED", stage="retrieval", request_id="rag")
        if self._load_error:
            raise module_error("INDEX_UNAVAILABLE", stage="retrieval", request_id="rag")
        try:
            normalized = await self._normalizer.normalize(request.query)
        except Exception as exc:
            raise map_provider_error(exc, stage="retrieval", request_id="rag") from exc
        if not isinstance(normalized, NormalizedQuery):
            normalized = NormalizedQuery.model_validate(normalized)
        queries = retrieval_strings(request.query, normalized)
        try:
            semantic_ids = self._semantic_rank(queries)
        except Exception as exc:
            raise map_provider_error(exc, stage="retrieval", request_id="rag") from exc
        bm25_ids = self._bm25_rank(queries)
        limit = min(request.top_k, self._fusion_top_k, _MAX_PROMPT_PASSAGES)
        fused = reciprocal_rank_fusion([semantic_ids, bm25_ids], limit=max(limit, 1))
        if not fused:
            return RetrievalResult(status="empty", passages=[], index_version=self.index_version)
        ranked = [(score, self._chunks[chunk_id]) for chunk_id, score in fused if chunk_id in self._chunks]
        ranked = self._with_context_neighbors(ranked, limit)
        passages = [_passage(chunk, " ".join(queries), score) for score, chunk in ranked]
        return RetrievalResult(status="found", passages=passages, index_version=self.index_version)

    async def answer_question(self, request: RagRequest) -> RagResult:
        """Safe fallback for direct RagPort callers; CampusAgent L1 uses Gemini generation."""
        retrieval = await self.retrieve_policy(
            RetrievalRequest(
                query=request.question,
                policy_scope=request.policy_scope,
                top_k=min(3, _MAX_PROMPT_PASSAGES),
                effective_at=request.effective_at,
            )
        )
        if retrieval.status == "empty":
            return RagResult(status="insufficient_evidence", answer=MSG_L1_EMPTY, citations=[])
        return RagResult(
            status="answered",
            answer=_grounded_excerpt(retrieval.passages),
            citations=[item.citation for item in retrieval.passages],
        )

    def chunk_text(self, chunk_id: str) -> str | None:
        chunk = self._chunks.get(chunk_id)
        return chunk.text if chunk is not None else None

    def _load_or_embed(self) -> np.ndarray:
        spec = IndexSpec(
            source_hash=self._source_hash,
            embedding_model=self._embedder.model_name,
            chunker_version=CHUNKER_VERSION,
            chunk_ids=self._chunk_ids,
            index_version=self.index_version,
        )
        if self._store is not None:
            cached = self._store.read(spec)
            if cached is not None:
                logger.info("hybrid_index_cache_hit version=%s chunks=%s", spec.index_version, len(self._chunk_ids))
                return _row_normalize(cached)
        texts = [self._chunks[chunk_id].text for chunk_id in self._chunk_ids]
        vectors = self._embedder.embed_documents(texts)
        if len(vectors) != len(self._chunk_ids):
            raise RuntimeError("embedding provider returned a different number of vectors than chunks")
        matrix = _row_normalize(np.asarray(vectors, dtype=np.float32))
        if self._store is not None:
            self._store.write(spec, matrix)
        return matrix

    def _semantic_rank(self, queries: list[str]) -> list[str]:
        if self._matrix is None or self._matrix.size == 0 or not queries:
            return []
        query_vectors = np.stack(
            [_as_unit_vector(self._embedder.embed_query(query), self._matrix.shape[1]) for query in queries]
        )
        similarities = np.max(query_vectors @ self._matrix.T, axis=0)
        order = np.argsort(-similarities)
        ranked: list[str] = []
        for index in order:
            score = float(similarities[int(index)])
            if score < self._min_cosine:
                break
            ranked.append(self._chunk_ids[int(index)])
            if len(ranked) >= self._semantic_top_k:
                break
        return ranked

    def _bm25_rank(self, queries: list[str]) -> list[str]:
        best: dict[str, float] = {}
        for query in queries:
            for score, chunk in self._index.score(query):
                previous = best.get(chunk.chunk_id)
                if previous is None or score > previous:
                    best[chunk.chunk_id] = score
        ordered = sorted(best.items(), key=lambda item: (-item[1], item[0]))
        return [chunk_id for chunk_id, _score in ordered[: self._bm25_top_k]]

    def _with_context_neighbors(
        self, ranked: list[tuple[float, IndexedChunk]], top_k: int
    ) -> list[tuple[float, IndexedChunk]]:
        """Keep the adjacent chunk of the strongest result for procedural context."""
        if not ranked or top_k == 1:
            return ranked[:top_k]
        selected = [ranked[0]]
        selected_ids = {ranked[0][1].chunk_id}
        strongest_score, strongest = ranked[0]
        document_ids = self._document_chunk_ids[strongest.document_id]
        position = document_ids.index(strongest.chunk_id)
        for neighbor_position in (position + 1, position - 1):
            if len(selected) == top_k or not 0 <= neighbor_position < len(document_ids):
                continue
            neighbor_id = document_ids[neighbor_position]
            neighbor = self._chunks[neighbor_id]
            selected.append((strongest_score, neighbor))
            selected_ids.add(neighbor_id)
        for item in ranked[1:]:
            if len(selected) == top_k:
                break
            if item[1].chunk_id not in selected_ids:
                selected.append(item)
                selected_ids.add(item[1].chunk_id)
        return selected


def _index_version(*, source_hash: str, embedding_model: str, chunk_count: int) -> str:
    payload = f"{source_hash}|{embedding_model}|{CHUNKER_VERSION}|{chunk_count}"
    digest = hashlib.sha256(payload.encode("utf-8")).hexdigest()[:12]
    return f"vinuni-hybrid-{digest}"


def _source_hash(directory: Path) -> str:
    digest = hashlib.sha256()
    for path in sorted(directory.glob("*.md")):
        digest.update(path.name.encode("utf-8"))
        digest.update(b"\0")
        digest.update(path.read_bytes())
        digest.update(b"\0")
    return digest.hexdigest()


def _row_normalize(matrix: np.ndarray) -> np.ndarray:
    data = np.asarray(matrix, dtype=np.float32)
    if data.ndim == 1:
        data = data.reshape(1, -1)
    norms = np.linalg.norm(data, axis=1, keepdims=True)
    norms = np.where(norms == 0.0, 1.0, norms)
    return data / norms


def _as_unit_vector(values: list[float], dimension: int) -> np.ndarray:
    vector = np.asarray(values, dtype=np.float32)
    if vector.shape != (dimension,):
        padded = np.zeros(dimension, dtype=np.float32)
        size = min(dimension, vector.size)
        padded[:size] = vector.reshape(-1)[:size]
        vector = padded
    norm = float(np.linalg.norm(vector))
    if norm == 0.0:
        return vector
    return vector / norm


def _load_markdown_chunks(directory: Path) -> list[IndexedChunk]:
    if not directory.is_dir():
        raise FileNotFoundError(directory)
    chunks: list[IndexedChunk] = []
    for path in sorted(directory.glob("*.md")):
        raw = path.read_text(encoding="utf-8")
        metadata, body = _front_matter(raw)
        source = str(metadata.get("source") or path.stem).strip()
        title = str(metadata.get("title") or source).strip()
        url = str(metadata.get("url") or "").strip() or None
        version = hashlib.sha256(raw.encode("utf-8")).hexdigest()[:12]
        title_tokens = content_tokens(f"{title} {source}")
        for position, locator, text in _chunk_markdown(_strip_navigation(body)):
            # Source/title terms are reliable metadata and help a direct service query
            # (for example “transcript”) outrank a passing mention in a general regulation.
            tokens = tuple([*content_tokens(text), *title_tokens, *title_tokens, *title_tokens])
            if not tokens:
                continue
            chunks.append(
                IndexedChunk(
                    document_id=source,
                    document_title=title,
                    document_version=version,
                    chunk_id=f"{source}-c{position:04d}",
                    locator=locator,
                    text=text,
                    url=url,
                    policy_scope="student_services",
                    effective_from=None,
                    effective_to=None,
                    tokens=tokens,
                    term_freq={token: tokens.count(token) for token in set(tokens)},
                )
            )
    return chunks


def _front_matter(raw: str) -> tuple[dict[str, str], str]:
    if not raw.startswith("---\n"):
        return {}, raw
    end = raw.find("\n---\n", 4)
    if end < 0:
        return {}, raw
    metadata: dict[str, str] = {}
    for line in raw[4:end].splitlines():
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        metadata[key.strip()] = value.strip().strip("\"'")
    return metadata, raw[end + 5 :]


def _strip_navigation(body: str) -> str:
    """Remove standalone crawl navigation links before indexing policy content.

    The processed website captures contain repeated menus. Those links repeat a
    document title in dozens of chunks and would otherwise outrank the actual
    policy or procedure text in BM25.
    """
    return "\n".join(line for line in body.splitlines() if not _LINK_ONLY_LINE.match(line))


def _chunk_markdown(body: str) -> list[tuple[int, str, str]]:
    chunks: list[tuple[int, str, str]] = []
    buffer: list[str] = []
    size = 0
    heading = "Nội dung"

    def flush() -> None:
        nonlocal buffer, size
        text = "\n".join(buffer).strip()
        if text:
            chunks.append((len(chunks) + 1, heading, text))
        tail = text[-_CHUNK_OVERLAP:].strip()
        buffer = [tail] if tail else []
        size = len(tail)

    for line in body.splitlines():
        stripped = line.strip()
        if stripped.startswith("#"):
            heading = stripped.lstrip("#").strip() or heading
        if buffer and size + len(line) + 1 > _CHUNK_SIZE:
            flush()
        buffer.append(line)
        size += len(line) + 1
    if buffer:
        flush()
    return chunks


def _passage(chunk: IndexedChunk, query: str, score: float) -> Passage:
    return Passage(
        citation=Citation(
            document_id=chunk.document_id,
            document_title=chunk.document_title,
            document_version=chunk.document_version,
            chunk_id=chunk.chunk_id,
            locator=chunk.locator,
            quote=quote_span(chunk.text, query),
            url=chunk.url,
        ),
        text=chunk.text,
        score=score,
    )


def _grounded_excerpt(passages: list[Passage]) -> str:
    lines = ["Thông tin tìm được trong tài liệu VinUni:"]
    for item in passages[:3]:
        lines.append(f"\n{item.citation.document_title} ({item.citation.locator}): {item.text}")
    return "\n".join(lines)[:10000]
