"""Reciprocal Rank Fusion for hybrid retrieval.

score(d) = sum 1 / (k + rank_i(d)) over each ranking list. k=60 is the standard
constant from Cormack, Clarke & Buettcher. Empty lists are skipped so a Vietnamese
query that misses BM25 can still return semantic hits.
"""

from __future__ import annotations

RRF_K = 60


def reciprocal_rank_fusion(
    ranked_id_lists: list[list[str]],
    *,
    k: int = RRF_K,
    limit: int = 5,
) -> list[tuple[str, float]]:
    scores: dict[str, float] = {}
    for ranked in ranked_id_lists:
        for rank, chunk_id in enumerate(ranked, start=1):
            if not chunk_id:
                continue
            scores[chunk_id] = scores.get(chunk_id, 0.0) + 1.0 / (k + rank)
    ordered = sorted(scores.items(), key=lambda item: (-item[1], item[0]))
    if limit <= 0:
        return ordered
    return ordered[:limit]
