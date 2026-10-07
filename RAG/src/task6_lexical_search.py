import logging
from typing import List
from rank_bm25 import BM25Okapi
from .contracts import SearchResult
from .config import settings
from .task4_vector_store import get_collection

logger = logging.getLogger(__name__)

_bm25_index = None
_cached_documents = []
_cached_ids = []
_cached_metadatas = []

def _build_bm25_index():
    global _bm25_index, _cached_documents, _cached_ids, _cached_metadatas
    try:
        collection = get_collection()
        results = collection.get(include=['documents', 'metadatas'])
        if not results or not results.get('ids'):
            return
        
        _cached_ids = results['ids']
        _cached_documents = results['documents']
        _cached_metadatas = results['metadatas']
        
        tokenized_corpus = [doc.lower().split() for doc in _cached_documents]
        _bm25_index = BM25Okapi(tokenized_corpus)
    except Exception as e:
        logger.error(f"Error building BM25 index: {e}")

def lexical_search(query: str, top_k: int = 10) -> List[SearchResult]:
    global _bm25_index
    if _bm25_index is None:
        _build_bm25_index()
        
    if _bm25_index is None or not _cached_documents:
        return []
        
    try:
        tokenized_query = query.lower().split()
        doc_scores = _bm25_index.get_scores(tokenized_query)
        
        top_indices = sorted(range(len(doc_scores)), key=lambda i: doc_scores[i], reverse=True)[:top_k]
        
        search_results = []
        for idx in top_indices:
            score = doc_scores[idx]
            if score > 0:
                search_results.append(SearchResult(
                    id=_cached_ids[idx],
                    content=_cached_documents[idx],
                    score=float(score),
                    metadata=_cached_metadatas[idx] if _cached_metadatas else {},
                    retrieval_method="bm25"
                ))
        return search_results
    except Exception as e:
        logger.error(f"Error in lexical_search: {e}")
        return []

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    res = lexical_search("housing application deadline", 5)
    for r in res:
        print(f"[{r.score:.4f}] {r.content[:50]}...")
