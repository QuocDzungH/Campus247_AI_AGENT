import logging
from typing import List
import re
import math
from collections import Counter
from .contracts import SearchResult
from .config import settings
from .task4_vector_store import get_collection

logger = logging.getLogger(__name__)

_pageindex_cached = False
_documents = []
_ids = []
_metadatas = []

def _load_documents():
    global _pageindex_cached, _documents, _ids, _metadatas
    try:
        collection = get_collection()
        results = collection.get(include=['documents', 'metadatas'])
        if results and results.get('ids'):
            _ids = results['ids']
            _documents = results['documents']
            _metadatas = results['metadatas']
            _pageindex_cached = True
    except Exception as e:
        logger.error(f"Error loading documents for pageindex: {e}")

def _compute_tfidf(query: str, docs: List[str]) -> List[float]:
    query_terms = re.findall(r'\w+', query.lower())
    if not query_terms:
        return [0.0] * len(docs)
    
    doc_term_freqs = [Counter(re.findall(r'\w+', doc.lower())) for doc in docs]
    N = len(docs)
    
    idf = {}
    for term in query_terms:
        df = sum(1 for d in doc_term_freqs if term in d)
        idf[term] = math.log((N + 1) / (df + 1)) + 1
        
    scores = []
    for tf in doc_term_freqs:
        score = 0.0
        doc_len = sum(tf.values()) or 1
        for term in query_terms:
            term_freq = tf.get(term, 0) / doc_len
            score += term_freq * idf.get(term, 0)
        scores.append(score)
    return scores

def pageindex_search(query: str, top_k: int = 5) -> List[SearchResult]:
    if not _pageindex_cached:
        _load_documents()
        
    if not _documents:
        return []
        
    try:
        scores = _compute_tfidf(query, _documents)
        
        top_indices = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)[:top_k]
        
        search_results = []
        for idx in top_indices:
            score = scores[idx]
            if score > 0:
                search_results.append(SearchResult(
                    id=_ids[idx],
                    content=_documents[idx],
                    score=float(score),
                    metadata=_metadatas[idx] if _metadatas else {},
                    retrieval_method="pageindex"
                ))
        return search_results
    except Exception as e:
        logger.error(f"Error in pageindex_search: {e}")
        return []

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    res = pageindex_search("contact support", 5)
    for r in res:
        print(f"[{r.score:.4f}] {r.content[:50]}...")
