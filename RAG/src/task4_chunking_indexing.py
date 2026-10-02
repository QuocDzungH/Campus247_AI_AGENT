import hashlib
import logging
from pathlib import Path
from typing import List
import yaml
import chromadb
from langchain_text_splitters import RecursiveCharacterTextSplitter

from contracts import Document, DocumentMetadata
from config import Settings

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

settings = Settings()
PROCESSED_DIR = Path("data/processed")
VECTORSTORE_DIR = Path("vectorstore")

VECTORSTORE_DIR.mkdir(parents=True, exist_ok=True)

def parse_frontmatter(content: str) -> tuple[dict, str]:
    """Parse YAML frontmatter from markdown content."""
    if content.startswith("---\n"):
        parts = content.split("---\n", 2)
        if len(parts) == 3:
            try:
                frontmatter = yaml.safe_load(parts[1])
                return frontmatter, parts[2].strip()
            except yaml.YAMLError:
                pass
    return {}, content

def load_documents() -> List[Document]:
    """Load all .md files from data/processed/, parse YAML frontmatter."""
    documents = []
    if not PROCESSED_DIR.exists():
        logger.warning(f"{PROCESSED_DIR} does not exist.")
        return documents

    for md_file in PROCESSED_DIR.glob("*.md"):
        try:
            with open(md_file, "r", encoding="utf-8") as f:
                content = f.read()
            
            metadata_dict, body_content = parse_frontmatter(content)
            
            # Default values if missing
            source = metadata_dict.get("source", "unknown")
            title = metadata_dict.get("title", md_file.stem)
            doc_type = metadata_dict.get("doc_type", "news")
            url = metadata_dict.get("url", None)
            
            metadata = DocumentMetadata(
                source=source,
                title=title,
                doc_type=doc_type,
                url=url,
                chunk_index=-1
            )
            
            doc_id = hashlib.md5(f"{source}_{title}".encode()).hexdigest()
            doc = Document(id=doc_id, content=body_content, metadata=metadata)
            documents.append(doc)
            logger.info(f"Loaded {md_file.name}")
        except Exception as e:
            logger.error(f"Error loading {md_file}: {e}")
            
    return documents

def chunk_documents(documents: List[Document], chunk_size: int = 500, overlap: int = 50) -> List[Document]:
    """Split using RecursiveCharacterTextSplitter, assign chunk_index, generate unique IDs."""
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=overlap,
        separators=["\\n\\n", "\\n", " ", ""]
    )
    
    chunks = []
    for doc in documents:
        texts = splitter.split_text(doc.content)
        for i, text in enumerate(texts):
            chunk_metadata = DocumentMetadata(
                source=doc.metadata.source,
                title=doc.metadata.title,
                doc_type=doc.metadata.doc_type,
                url=doc.metadata.url,
                chunk_index=i
            )
            chunk_id = f"{doc.id}_chunk_{i}"
            chunks.append(Document(id=chunk_id, content=text, metadata=chunk_metadata))
            
    logger.info(f"Created {len(chunks)} chunks from {len(documents)} documents.")
    return chunks

def get_collection():
    """Get or create ChromaDB collection."""
    try:
        from chromadb.utils import embedding_functions
        
        api_key = getattr(settings, "OPENAI_API_KEY", None)
        if api_key:
            ef = embedding_functions.OpenAIEmbeddingFunction(
                api_key=api_key,
                model_name="text-embedding-3-small"
            )
        else:
            logger.warning("OPENAI_API_KEY not found in settings, using default embedding function")
            ef = embedding_functions.DefaultEmbeddingFunction()
            
        client = chromadb.PersistentClient(path=str(VECTORSTORE_DIR))
        collection = client.get_or_create_collection(
            name="vinuni_rag",
            embedding_function=ef
        )
        return collection
    except ImportError:
        logger.error("chromadb is not installed. Please install it.")
        raise
    except Exception as e:
        logger.error(f"Error initializing ChromaDB: {e}")
        raise

def index_to_vectorstore(chunks: List[Document]) -> None:
    """Upsert chunks to ChromaDB (no duplicates)."""
    if not chunks:
        logger.info("No chunks to index.")
        return
        
    collection = get_collection()
    
    ids = [chunk.id for chunk in chunks]
    documents = [chunk.content for chunk in chunks]
    metadatas = [chunk.metadata.model_dump() for chunk in chunks]
    
    collection.upsert(
        ids=ids,
        documents=documents,
        metadatas=metadatas
    )
    logger.info(f"Upserted {len(chunks)} chunks into vectorstore.")

def main():
    logger.info("Starting chunking and indexing pipeline...")
    
    docs = load_documents()
    chunks = chunk_documents(docs, chunk_size=500, overlap=50)
    index_to_vectorstore(chunks)
    
    logger.info("Pipeline finished successfully.")

if __name__ == "__main__":
    main()
