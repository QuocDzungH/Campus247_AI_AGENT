import logging
from typing import List
from .contracts import SearchResult
from .config import settings
from .task4_vector_store import get_collection, embed_texts

logger = logging.getLogger(__name__)

def semantic_search(query: str, top_k: int = 10) -> List[SearchResult]:
    try:
        collection = get_collection()
        query_embedding = embed_texts([query])[0]
        results = collection.query(
            query_embeddings=[query_embedding],
            n_results=top_k,
            include=['documents', 'metadatas', 'distances']
        )
        
        search_results = []
        if results and results.get('ids') and len(results['ids'][0]) > 0:
            for i in range(len(results['ids'][0])):
                distance = results['distances'][0][i] if 'distances' in results and results['distances'] else 0.0
                score = 1.0 - distance
                
                search_results.append(SearchResult(
                    id=results['ids'][0][i],
                    content=results['documents'][0][i],
                    score=score,
                    metadata=results['metadatas'][0][i] if 'metadatas' in results and results['metadatas'] else {},
                    retrieval_method="dense"
                ))
        search_results.sort(key=lambda x: x.score, reverse=True)
        return search_results
    except Exception as e:
        logger.error(f"Error in semantic_search: {e}")
        return []

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    res = semantic_search("How to apply for housing?", 5)
    for r in res:
        print(f"[{r.score:.4f}] {r.content[:50]}...")
