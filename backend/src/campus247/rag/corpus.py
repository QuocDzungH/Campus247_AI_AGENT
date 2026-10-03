"""CorpusRag: retrieve real passages from the packaged demo academic corpus."""

from __future__ import annotations

import json
import logging
from collections import Counter
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from campus247.agents.errors import module_error
from campus247.models.contracts_v1 import (
    Citation,
    Passage,
    RagRequest,
    RagResult,
    RetrievalRequest,
    RetrievalResult,
)
from campus247.rag.lexical import IndexedChunk, LexicalIndex, content_tokens, quote_span
from campus247.services.common import MSG_L1_EMPTY

logger = logging.getLogger("campus247.rag")

PACKAGED_CORPUS = Path(__file__).resolve().parent / "data" / "demo_academic_v1.json"
_SCOPE_ALIASES = {
    "demo_academic": "demo_academic",
    "academic": "demo_academic",
}
_DEMO_PREFIX = "Đây là thông tin từ tài liệu demo Campus 24/7, không phải quy chế vận hành chính thức.\n\n"


class CorpusRag:
    """Lexical RagPort over approved, in-force demo chunks. Empty match stays insufficient_evidence."""

    def __init__(
        self,
        corpus: dict[str, Any] | None = None,
        *,
        load_error: str | None = None,
        index_version: str | None = None,
    ) -> None:
        self._load_error = load_error
        self.index_version = index_version or "unavailable"
        self._index_by_scope: dict[str, LexicalIndex] = {}
        self._chunks_by_id: dict[str, IndexedChunk] = {}
        if load_error or corpus is None:
            return
        self.index_version = str(corpus.get("index_version") or "edu14-demo-academic-v1")
        self._ingest(corpus)

    @classmethod
    def from_packaged(cls) -> CorpusRag:
        return cls.from_path(PACKAGED_CORPUS)

    @classmethod
    def from_path(cls, path: Path) -> CorpusRag:
        try:
            raw = json.loads(path.read_text(encoding="utf-8"))
            if not isinstance(raw, dict) or not raw.get("documents"):
                raise ValueError("corpus missing documents")
            return cls(raw)
        except Exception:
            logger.warning("corpus_index_unavailable path=%s", path)
            return cls(None, load_error="index_load_failed", index_version="unavailable")

    async def retrieve_policy(self, request: RetrievalRequest) -> RetrievalResult:
        index = self._index_for(request.policy_scope, request_id="rag")
        ranked = [
            (score, chunk) for score, chunk in index.score(request.query) if _in_force(chunk, request.effective_at)
        ]
        top = ranked[: request.top_k]
        if not top:
            return RetrievalResult(status="empty", passages=[], index_version=self.index_version)
        passages = [_passage(chunk, request.query, score) for score, chunk in top]
        return RetrievalResult(status="found", passages=passages, index_version=self.index_version)

    async def answer_question(self, request: RagRequest) -> RagResult:
        retrieval = await self.retrieve_policy(
            RetrievalRequest(
                query=request.question,
                policy_scope=request.policy_scope,
                top_k=3,
                effective_at=request.effective_at,
            )
        )
        if retrieval.status != "found":
            return RagResult(status="insufficient_evidence", answer=MSG_L1_EMPTY, citations=[])
        citations = [item.citation for item in retrieval.passages]
        answer = _compose_answer(retrieval.passages)
        return RagResult(status="answered", answer=answer, citations=citations)

    def chunk_text(self, chunk_id: str) -> str | None:
        chunk = self._chunks_by_id.get(chunk_id)
        return chunk.text if chunk is not None else None

    def _index_for(self, policy_scope: str, *, request_id: str) -> LexicalIndex:
        if self._load_error:
            raise module_error("INDEX_UNAVAILABLE", stage="retrieval", request_id=request_id)
        canonical = _SCOPE_ALIASES.get(policy_scope)
        if canonical is None:
            raise module_error("POLICY_SCOPE_DENIED", stage="retrieval", request_id=request_id)
        return self._index_by_scope.get(canonical) or LexicalIndex([])

    def _ingest(self, corpus: dict[str, Any]) -> None:
        grouped: dict[str, list[IndexedChunk]] = {}
        for document in corpus.get("documents") or []:
            if not document.get("approved"):
                continue
            scope = str(document.get("policy_scope") or "")
            canonical = _SCOPE_ALIASES.get(scope, scope)
            for raw_chunk in document.get("chunks") or []:
                text = str(raw_chunk.get("text") or "").strip()
                chunk_id = str(raw_chunk.get("chunk_id") or "").strip()
                if not text or not chunk_id:
                    continue
                tokens = tuple(content_tokens(text))
                chunk = IndexedChunk(
                    document_id=str(document.get("document_id") or chunk_id),
                    document_title=str(document.get("document_title") or "Tài liệu demo"),
                    document_version=str(document.get("document_version") or "demo"),
                    chunk_id=chunk_id,
                    locator=str(raw_chunk.get("locator") or chunk_id),
                    text=text,
                    url=document.get("url"),
                    policy_scope=canonical,
                    effective_from=_parse_dt(document.get("effective_from")),
                    effective_to=_parse_dt(document.get("effective_to")),
                    tokens=tokens,
                    term_freq=dict(Counter(tokens)),
                )
                self._chunks_by_id[chunk.chunk_id] = chunk
                grouped.setdefault(canonical, []).append(chunk)
        self._index_by_scope = {scope: LexicalIndex(chunks) for scope, chunks in grouped.items()}


def _parse_dt(value: object) -> datetime | None:
    if value in (None, ""):
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=UTC)
    text = str(value).replace("Z", "+00:00")
    parsed = datetime.fromisoformat(text)
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=UTC)


def _in_force(chunk: IndexedChunk, effective_at: datetime) -> bool:
    moment = effective_at if effective_at.tzinfo else effective_at.replace(tzinfo=UTC)
    if chunk.effective_from is not None and moment < chunk.effective_from:
        return False
    if chunk.effective_to is not None and moment > chunk.effective_to:
        return False
    return True


def _passage(chunk: IndexedChunk, query: str, score: float) -> Passage:
    quote = quote_span(chunk.text, query)
    return Passage(
        citation=Citation(
            document_id=chunk.document_id,
            document_title=chunk.document_title,
            document_version=chunk.document_version,
            chunk_id=chunk.chunk_id,
            locator=chunk.locator,
            quote=quote,
            url=chunk.url,
        ),
        text=chunk.text[:10000],
        score=score,
    )


def _compose_answer(passages: list[Passage]) -> str:
    parts = []
    for item in passages[:3]:
        citation = item.citation
        parts.append(f"{citation.document_title} ({citation.locator}): {item.text.strip()}")
    return (_DEMO_PREFIX + "\n\n".join(parts))[:10000]
