"""In-memory lexical BM25 over packaged chunk text. No query→citation lookup table."""

from __future__ import annotations

import math
import re
from collections import Counter
from dataclasses import dataclass

_TOKEN = re.compile(
    r"[0-9a-zàáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]+",
    re.IGNORECASE,
)
_STOP = frozenset(
    {
        "là",
        "của",
        "và",
        "cho",
        "với",
        "các",
        "một",
        "những",
        "được",
        "trong",
        "về",
        "như",
        "thế",
        "nào",
        "ở",
        "đâu",
        "tôi",
        "muốn",
        "hỏi",
        "có",
        "không",
        "để",
        "khi",
        "gì",
        "hay",
        "hoặc",
        "thì",
        "này",
        "đó",
        "cần",
        "hiện",
        "tại",
        "theo",
        "từ",
        "trên",
        "sau",
        "trước",
        "nên",
        "vào",
        "ra",
        "lại",
        "rồi",
        "đã",
        "sẽ",
        "bị",
        "do",
        "vì",
        "nếu",
        "mà",
        "cũng",
        "rất",
        "the",
        "a",
        "an",
        "of",
        "to",
        "in",
        "on",
        "for",
        "and",
    }
)
_K1 = 1.5
_B = 0.75


def tokenize(text: str) -> list[str]:
    return [match.group(0).lower() for match in _TOKEN.finditer(text or "")]


def content_tokens(text: str) -> list[str]:
    return [token for token in tokenize(text) if token not in _STOP and len(token) > 1]


@dataclass(frozen=True)
class IndexedChunk:
    document_id: str
    document_title: str
    document_version: str
    chunk_id: str
    locator: str
    text: str
    url: str | None
    policy_scope: str
    effective_from: object
    effective_to: object
    tokens: tuple[str, ...]
    term_freq: dict[str, int]


class LexicalIndex:
    def __init__(self, chunks: list[IndexedChunk]):
        self.chunks = list(chunks)
        self._avgdl = (sum(len(item.tokens) for item in self.chunks) / len(self.chunks)) if self.chunks else 0.0
        df: Counter[str] = Counter()
        for item in self.chunks:
            df.update(set(item.tokens))
        self._df = dict(df)
        self._n = len(self.chunks)

    def score(self, query: str) -> list[tuple[float, IndexedChunk]]:
        query_tokens = content_tokens(query)
        if not query_tokens or not self.chunks:
            return []
        query_set = set(query_tokens)
        ranked: list[tuple[float, IndexedChunk]] = []
        for chunk in self.chunks:
            overlap = query_set.intersection(chunk.tokens)
            if not _enough_overlap(overlap):
                continue
            value = _bm25(query_tokens, chunk, self._df, self._n, self._avgdl)
            if value > 0:
                ranked.append((value, chunk))
        ranked.sort(key=lambda item: item[0], reverse=True)
        return ranked


def _enough_overlap(overlap: set[str]) -> bool:
    if any(len(token) >= 5 for token in overlap):
        return True
    medium = {token for token in overlap if len(token) >= 4}
    return len(medium) >= 2


def _bm25(query_tokens: list[str], chunk: IndexedChunk, df: dict[str, int], n: int, avgdl: float) -> float:
    score = 0.0
    length = len(chunk.tokens) or 1
    for token in query_tokens:
        tf = chunk.term_freq.get(token, 0)
        if tf <= 0:
            continue
        docs_with = df.get(token, 0)
        idf = math.log((n - docs_with + 0.5) / (docs_with + 0.5) + 1.0)
        denom = tf + _K1 * (1.0 - _B + _B * length / (avgdl or 1.0))
        score += idf * (tf * (_K1 + 1.0)) / denom
    return score


def quote_span(text: str, query: str, limit: int = 400) -> str:
    """Return an exact substring of text, biased toward query terms."""
    stripped = text.strip()
    if not stripped:
        return text[:limit]
    if len(stripped) <= limit:
        return stripped
    query_tokens = content_tokens(query)
    lowered = stripped.lower()
    best_start = 0
    best_score = -1
    step = max(40, limit // 4)
    for start in range(0, len(stripped) - limit + 1, step):
        window = lowered[start : start + limit]
        score = sum(1 for token in query_tokens if token in window)
        if score > best_score:
            best_score = score
            best_start = start
    return stripped[best_start : best_start + limit]
