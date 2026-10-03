import logging
from typing import List, Dict
from .contracts import SearchResult
from .task5_semantic_search import semantic_search
from .task6_lexical_search import lexical_search

logger = logging.getLogger(__name__)

def rerank_rrf(ranked_lists: List[List[SearchResult]], top_k: int = 5, k: int = 60) -> List[SearchResult]:
    try:
        rrf_scores: Dict[str, float] = {}
        items_dict: Dict[str, SearchResult] = {}
        
        for ranked_list in ranked_lists:
            for rank, item in enumerate(ranked_list, start=1):
                if item.id not in rrf_scores:
                    rrf_scores[item.id] = 0.0
                    items_dict[item.id] = item
                rrf_scores[item.id] += 1.0 / (k + rank)
                
        reranked_results = []
        for doc_id, score in rrf_scores.items():
            original_item = items_dict[doc_id]
            reranked_results.append(SearchResult(
                id=original_item.id,
                content=original_item.content,
                score=score,
                metadata=original_item.metadata,
                retrieval_method="hybrid"
            ))
            
        reranked_results.sort(key=lambda x: x.score, reverse=True)
        return reranked_results[:top_k]
    except Exception as e:
        logger.error(f"Error in rerank_rrf: {e}")
        return []

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    q = "academic calendar"
    dense = semantic_search(q, 5)
    sparse = lexical_search(q, 5)
    hybrid = rerank_rrf([dense, sparse], 5)
    for r in hybrid:
        print(f"[{r.score:.4f}] {r.content[:50]}...")
