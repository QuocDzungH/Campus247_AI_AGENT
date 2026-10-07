import os
from pathlib import Path
from typing import List
import chromadb
from chromadb.utils import embedding_functions
from .config import settings

BASE_DIR = Path(__file__).resolve().parent.parent
VECTORSTORE_DIR = BASE_DIR / "vectorstore"

_collection = None
_embedding_function = None

def get_embedding_function():
    global _embedding_function
    if _embedding_function is None:
        api_key = settings.openai_api_key or os.getenv("OPENAI_API_KEY", "")
        if api_key:
            _embedding_function = embedding_functions.OpenAIEmbeddingFunction(
                api_key=api_key,
                model_name=settings.embedding_model or "text-embedding-3-small"
            )
        else:
            _embedding_function = embedding_functions.DefaultEmbeddingFunction()
    return _embedding_function

def embed_texts(texts: List[str]) -> List[List[float]]:
    ef = get_embedding_function()
    return ef(texts)

def get_collection():
    global _collection
    if _collection is None:
        client = chromadb.PersistentClient(path=str(VECTORSTORE_DIR))
        ef = get_embedding_function()
        _collection = client.get_or_create_collection(
            name=settings.chroma_collection or "vinuni_docs",
            embedding_function=ef,
            metadata={"hnsw:space": "cosine"}
        )
    return _collection
