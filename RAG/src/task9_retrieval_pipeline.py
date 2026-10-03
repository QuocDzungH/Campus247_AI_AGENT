import logging
from typing import List
from .contracts import SearchResult
from .config import settings
from .task5_semantic_search import semantic_search
from .task6_lexical_search import lexical_search
from .task7_reranking import rerank_rrf
from .task8_fallback import pageindex_search

logger = logging.getLogger(__name__)

def retrieve(query: str, top_k: int = 5, score_threshold: float = None, use_reranking: bool = True) -> List[SearchResult]:
    try:
        if score_threshold is None:
            score_threshold = getattr(settings, 'SCORE_THRESHOLD', 0.5)
            
        dense_results = semantic_search(query, top_k=top_k * 2)
        
        best_dense_score = dense_results[0].score if dense_results else 0.0
        
        if best_dense_score < score_threshold:
            logger.info(f"Best dense score {best_dense_score:.4f} < {score_threshold}. Using pageindex fallback.")
            return pageindex_search(query, top_k=top_k)
            
        if use_reranking:
            sparse_results = lexical_search(query, top_k=top_k * 2)
            hybrid_results = rerank_rrf([dense_results, sparse_results], top_k=top_k, k=getattr(settings, 'RRF_K', 60))
            return hybrid_results
            
        return dense_results[:top_k]
    except Exception as e:
        logger.error(f"Error in retrieve pipeline: {e}")
        return []

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    res = retrieve("complaint regarding grading", 5)
    for r in res:
        print(f"[{r.retrieval_method}] [{r.score:.4f}] {r.content[:50]}...")
