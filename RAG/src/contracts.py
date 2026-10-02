from typing import Literal, List, Optional, Dict, Any, Union
from pydantic import BaseModel, Field

class DocumentMetadata(BaseModel):
    source: str = "unknown"
    title: str = ""
    doc_type: str = "policy"
    url: Optional[str] = ""
    chunk_index: Optional[int] = -1
    category: Optional[str] = "general"

class Document(BaseModel):
    id: str
    content: str
    metadata: Union[DocumentMetadata, Dict[str, Any]] = Field(default_factory=dict)

class SearchResult(BaseModel):
    id: str
    content: str
    score: float
    metadata: Union[DocumentMetadata, Dict[str, Any]] = Field(default_factory=dict)
    retrieval_method: Literal["dense", "bm25", "hybrid", "pageindex"] = "dense"

class GenerationResult(BaseModel):
    answer: str
    sources: List[SearchResult] = Field(default_factory=list)
    retrieval_source: Literal["hybrid", "pageindex", "none"] = "none"

class DataSource(BaseModel):
    url: str
    doc_type: str
    priority: int
    category: str
    description: str
