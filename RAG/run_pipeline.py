"""VinUni RAG Pipeline — End-to-end Data Ingestion & Indexing Runner.

Crawl -> Convert -> Chunk -> ChromaDB Index -> Verification.
"""
import asyncio
import hashlib
import json
import logging
import os
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List
from urllib.parse import urlparse

import httpx
from bs4 import BeautifulSoup
import chromadb
from chromadb.utils.embedding_functions import OpenAIEmbeddingFunction
import yaml

# ─── Logging Setup ────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("rag_pipeline")

# ─── Directories ──────────────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
LANDING_NEWS = DATA_DIR / "landing" / "news"
LANDING_LEGAL = DATA_DIR / "landing" / "legal"
PROCESSED_DIR = DATA_DIR / "processed"
VECTORSTORE_DIR = BASE_DIR / "vectorstore"

for d in [LANDING_NEWS, LANDING_LEGAL, PROCESSED_DIR, VECTORSTORE_DIR]:
    d.mkdir(parents=True, exist_ok=True)

# ─── Environment Variables ────────────────────────────────────────────
def load_env_vars():
    for env_path in [BASE_DIR / ".env", BASE_DIR.parent / ".env"]:
        if env_path.exists():
            logger.info(f"Loading environment from {env_path}")
            with open(env_path, encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, _, v = line.partition("=")
                        k = k.strip()
                        v = v.strip().strip("'\"")
                        if k:
                            os.environ.setdefault(k, v)
            return

load_env_vars()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "text-embedding-3-small")
CHROMA_COLLECTION = os.getenv("CHROMA_COLLECTION", "vinuni_docs")
CRAWL_DELAY = float(os.getenv("CRAWL_DELAY", "1.0"))

if not OPENAI_API_KEY:
    logger.error("OPENAI_API_KEY is not set! Please check .env file.")
else:
    logger.info(f"Using OpenAI API Key: {OPENAI_API_KEY[:8]}...{OPENAI_API_KEY[-4:]}")

# ─── Data Sources Definition ──────────────────────────────────────────
DATA_SOURCES: Dict[str, Dict[str, Any]] = {
    "request_transcripts": {
        "url": "https://registrar.vinuni.edu.vn/academics/request-transcripts-certifications/",
        "doc_type": "policy",
        "category": "xin_giay_to",
        "description": "Loại giấy, điều kiện, phí, thời gian xử lý, cách nhận",
    },
    "document_request_form": {
        "url": "https://forms.office.com/pages/responsepage.aspx?id=iSf4WJVmSk-r2zV2aNVc_0dbBYw8WtJPgbnOOjH80gpUNDRJUExIOEoxQzA0RE9CRE9XWVM1M0QxSS4u&route=shorturl",
        "doc_type": "form",
        "category": "xin_giay_to",
        "description": "Hướng dẫn sinh viên điền và gửi yêu cầu giấy tờ",
    },
    "escalation_procedure": {
        "url": "https://policy.vinuni.edu.vn/all-policies/formal-escalation-management-procedure-for-students/",
        "doc_type": "policy",
        "category": "khieu_nai",
        "description": "Phạm vi, quy trình, nơi tiếp nhận, thời hạn xử lý khiếu nại",
    },
    "escalation_pdf": {
        "url": "https://policy.vinuni.edu.vn/wp-content/uploads/2025/02/20251224_GDL-SAM-007-V2.0_Formal-Escalation-Management-Procedure-for-Students.pdf",
        "doc_type": "legal",
        "category": "khieu_nai",
        "description": "Quy trình giải quyết khiếu nại sinh viên (V2.0 PDF)",
    },
    "academic_regulations": {
        "url": "https://policy.vinuni.edu.vn/all-policies/academic-regulations-for-full-time-undergraduate-programs/",
        "doc_type": "policy",
        "category": "phuc_khao",
        "description": "Quy chế học vụ và phúc khảo điểm chương trình đại học chính quy",
    },
    "academic_integrity": {
        "url": "https://policy.vinuni.edu.vn/all-policies/student-academic-integrity/",
        "doc_type": "policy",
        "category": "liem_chinh",
        "description": "Quy định liêm chính học thuật và xử lý vi phạm",
    },
    "code_of_conduct": {
        "url": "https://policy.vinuni.edu.vn/all-policies/student-affairs-regulations-code-of-conduct/",
        "doc_type": "policy",
        "category": "ung_xu_ky_luat",
        "description": "Quy tắc ứng xử và kỷ luật sinh viên",
    },
    "residential_life": {
        "url": "https://policy.vinuni.edu.vn/all-policies/residential-life-guideline/",
        "doc_type": "policy",
        "category": "ky_tuc_xa",
        "description": "Quy định ký túc xá: giờ giấc, vệ sinh, an toàn",
    },
    "library_policy": {
        "url": "https://policy.vinuni.edu.vn/all-policies/library-policies-for-users/",
        "doc_type": "policy",
        "category": "thu_vien",
        "description": "Nội quy thư viện, mượn trả tài liệu và thiết bị",
    },
    "facility_usage": {
        "url": "https://policy.vinuni.edu.vn/all-policies/facility-usage-regulations-including-facilities-for-rent/",
        "doc_type": "policy",
        "category": "co_so_vat_chat",
        "description": "Quy định sử dụng cơ sở vật chất và không gian trường",
    },
    "room_bookings": {
        "url": "https://registrar.vinuni.edu.vn/internal-services/room-bookings/",
        "doc_type": "policy",
        "category": "dat_phong",
        "description": "Thủ tục và quy định đặt phòng học/phòng họp",
    },
}

# ─── 1. Crawl & Download ──────────────────────────────────────────────
async def crawl_and_download():
    logger.info("=" * 60)
    logger.info("PHASE 1: Crawling URLs & Downloading PDFs")
    logger.info("=" * 60)

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    }

    async with httpx.AsyncClient(headers=headers, timeout=45.0, follow_redirects=True) as client:
        for sid, meta in DATA_SOURCES.items():
            url = meta["url"]
            is_pdf = url.lower().endswith(".pdf")

            if is_pdf:
                dest = LANDING_LEGAL / f"{sid}.pdf"
                logger.info(f"📥 [PDF] Downloading {sid}...")
                try:
                    res = await client.get(url)
                    res.raise_for_status()
                    dest.write_bytes(res.content)
                    logger.info(f"   -> Saved {len(res.content) / 1024:.1f} KB to {dest.name}")
                except Exception as e:
                    logger.error(f"   -> Failed downloading PDF {url}: {e}")
            else:
                dest = LANDING_NEWS / f"{sid}.json"
                logger.info(f"🌐 [WEB] Crawling {sid} ({url})...")
                try:
                    res = await client.get(url)
                    res.raise_for_status()
                    soup = BeautifulSoup(res.text, "html.parser")
                    page_title = soup.title.get_text(strip=True) if soup.title else sid

                    record = {
                        "source_id": sid,
                        "url": url,
                        "title": page_title,
                        "date_crawled": datetime.now(timezone.utc).isoformat(),
                        "doc_type": meta["doc_type"],
                        "category": meta["category"],
                        "description": meta["description"],
                        "html": res.text,
                    }
                    dest.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding="utf-8")
                    logger.info(f"   -> Saved: '{page_title}' ({len(res.text)} chars)")
                except Exception as e:
                    logger.error(f"   -> Failed crawling {url}: {e}")

            await asyncio.sleep(CRAWL_DELAY)

# ─── 2. Convert to Clean Markdown ──────────────────────────────────────
def convert_to_markdown():
    logger.info("=" * 60)
    logger.info("PHASE 2: Converting Crawled Data to Markdown")
    logger.info("=" * 60)

    # Convert Web JSON -> Markdown
    for json_file in LANDING_NEWS.glob("*.json"):
        try:
            data = json.loads(json_file.read_text(encoding="utf-8"))
            soup = BeautifulSoup(data.get("html", ""), "html.parser")

            # Remove noise elements
            for tag in soup(["script", "style", "nav", "header", "footer", "aside", "noscript", "svg", "button"]):
                tag.decompose()

            # Target article/content block if present
            content_node = (
                soup.find("article")
                or soup.find("main")
                or soup.find("div", class_=re.compile(r"content|entry|post|page-content|body", re.I))
                or soup.body
                or soup
            )

            text = content_node.get_text(separator="\n\n", strip=True)
            # Remove excessive whitespace
            text = re.sub(r"\n{3,}", "\n\n", text)

            sid = data.get("source_id", json_file.stem)
            title = data.get("title", sid)
            frontmatter = (
                f"---\n"
                f"source: \"{sid}\"\n"
                f"title: \"{title}\"\n"
                f"url: \"{data.get('url', '')}\"\n"
                f"doc_type: \"{data.get('doc_type', 'policy')}\"\n"
                f"category: \"{data.get('category', 'general')}\"\n"
                f"---\n\n"
            )

            out_file = PROCESSED_DIR / f"{sid}.md"
            out_file.write_text(frontmatter + text, encoding="utf-8")
            logger.info(f"📝 Converted web page {json_file.stem} -> {out_file.name} ({len(text)} chars)")
        except Exception as e:
            logger.error(f"Error converting {json_file.name}: {e}")

    # Convert PDF -> Markdown
    for pdf_file in LANDING_LEGAL.glob("*.pdf"):
        sid = pdf_file.stem
        meta = DATA_SOURCES.get(sid, {})
        extracted_text = ""
        try:
            # Try markitdown first
            from markitdown import MarkItDown
            md = MarkItDown()
            res = md.convert(str(pdf_file))
            extracted_text = res.text_content
        except Exception:
            # Fallback to PyPDF2
            try:
                import PyPDF2
                with open(pdf_file, "rb") as f:
                    reader = PyPDF2.PdfReader(f)
                    extracted_text = "\n\n".join(page.extract_text() or "" for page in reader.pages)
            except Exception as e2:
                logger.error(f"Could not extract text from {pdf_file.name}: {e2}")

        if extracted_text:
            frontmatter = (
                f"---\n"
                f"source: \"{sid}\"\n"
                f"title: \"{meta.get('description', sid)}\"\n"
                f"url: \"{meta.get('url', '')}\"\n"
                f"doc_type: \"legal\"\n"
                f"category: \"{meta.get('category', 'khieu_nai')}\"\n"
                f"---\n\n"
            )
            out_file = PROCESSED_DIR / f"{sid}.md"
            out_file.write_text(frontmatter + extracted_text, encoding="utf-8")
            logger.info(f"📄 Converted PDF {pdf_file.name} -> {out_file.name} ({len(extracted_text)} chars)")

# ─── 3. Chunk Documents ───────────────────────────────────────────────
def chunk_markdown_files(chunk_size: int = 600, overlap: int = 100) -> List[Dict[str, Any]]:
    logger.info("=" * 60)
    logger.info("PHASE 3: Chunking Processed Documents")
    logger.info("=" * 60)

    chunks = []
    for md_path in sorted(PROCESSED_DIR.glob("*.md")):
        raw = md_path.read_text(encoding="utf-8")
        meta = {}
        body = raw

        if raw.startswith("---\n"):
            parts = raw.split("---\n", 2)
            if len(parts) >= 3:
                try:
                    meta = yaml.safe_load(parts[1]) or {}
                except Exception:
                    pass
                body = parts[2].strip()

        source_id = meta.get("source", md_path.stem)
        title = meta.get("title", source_id)
        url = meta.get("url", "")
        doc_type = meta.get("doc_type", "policy")
        category = meta.get("category", "general")

        paragraphs = [p.strip() for p in re.split(r"\n{2,}", body) if p.strip()]

        current_text = ""
        chunk_idx = 0

        for p in paragraphs:
            if len(current_text) + len(p) + 2 > chunk_size and current_text:
                cid = hashlib.md5(f"{source_id}_{chunk_idx}".encode()).hexdigest()
                chunks.append({
                    "id": cid,
                    "content": current_text.strip(),
                    "metadata": {
                        "source": source_id,
                        "title": title,
                        "url": url,
                        "doc_type": doc_type,
                        "category": category,
                        "chunk_index": chunk_idx,
                    }
                })
                # Overlap
                words = current_text.split()
                overlap_text = " ".join(words[-overlap:]) if len(words) > overlap else current_text
                current_text = overlap_text + "\n\n" + p
                chunk_idx += 1
            else:
                current_text += ("\n\n" if current_text else "") + p

        if current_text.strip():
            cid = hashlib.md5(f"{source_id}_{chunk_idx}".encode()).hexdigest()
            chunks.append({
                "id": cid,
                "content": current_text.strip(),
                "metadata": {
                    "source": source_id,
                    "title": title,
                    "url": url,
                    "doc_type": doc_type,
                    "category": category,
                    "chunk_index": chunk_idx,
                }
            })

    logger.info(f"✂️  Produced {len(chunks)} chunks across {len(list(PROCESSED_DIR.glob('*.md')))} documents.")
    return chunks

# ─── 4. Index Chunks to ChromaDB ──────────────────────────────────────
def index_to_chromadb(chunks: List[Dict[str, Any]]):
    logger.info("=" * 60)
    logger.info(f"PHASE 4: Indexing to ChromaDB ({VECTORSTORE_DIR})")
    logger.info("=" * 60)

    if not chunks:
        logger.warning("No chunks to index!")
        return

    ef = OpenAIEmbeddingFunction(
        api_key=OPENAI_API_KEY,
        model_name=EMBEDDING_MODEL,
    )

    client = chromadb.PersistentClient(path=str(VECTORSTORE_DIR))

    # Reset collection for fresh index
    try:
        client.delete_collection(name=CHROMA_COLLECTION)
        logger.info(f"Cleared previous collection: {CHROMA_COLLECTION}")
    except Exception:
        pass

    collection = client.create_collection(
        name=CHROMA_COLLECTION,
        embedding_function=ef,
        metadata={"hnsw:space": "cosine"},
    )

    # Upsert in batches of 100
    batch_size = 100
    for i in range(0, len(chunks), batch_size):
        batch = chunks[i : i + batch_size]
        collection.upsert(
            ids=[c["id"] for c in batch],
            documents=[c["content"] for c in batch],
            metadatas=[c["metadata"] for c in batch],
        )
        logger.info(f"   Indexed batch {i // batch_size + 1} ({len(batch)} chunks)")

    count = collection.count()
    logger.info(f"✅ Indexed {count} total chunks into collection '{CHROMA_COLLECTION}' successfully!")

# ─── 5. Test Retrieval Verification ──────────────────────────────────
def verify_pipeline():
    logger.info("=" * 60)
    logger.info("PHASE 5: Verifying RAG Search")
    logger.info("=" * 60)

    test_queries = [
        "Xin bảng điểm transcript như thế nào?",
        "Quy trình khiếu nại của sinh viên gồm những bước nào?",
        "Giờ yên tĩnh tại ký túc xá là mấy giờ?",
    ]

    ef = OpenAIEmbeddingFunction(
        api_key=OPENAI_API_KEY,
        model_name=EMBEDDING_MODEL,
    )
    client = chromadb.PersistentClient(path=str(VECTORSTORE_DIR))
    collection = client.get_collection(name=CHROMA_COLLECTION, embedding_function=ef)

    for q in test_queries:
        res = collection.query(query_texts=[q], n_results=2)
        logger.info(f"\n🔍 Query: '{q}'")
        if res and res.get("documents") and res["documents"][0]:
            for rank, (doc, meta, dist) in enumerate(zip(res["documents"][0], res["metadatas"][0], res["distances"][0]), start=1):
                sim = 1.0 - dist
                logger.info(f"   [{rank}] (Sim: {sim:.3f}) Source: {meta.get('title', 'Unknown')} ({meta.get('category')})")
                snippet = doc.replace("\n", " ")[:120]
                logger.info(f"       Preview: {snippet}...")
        else:
            logger.warning("   No results found!")

# ─── Main Orchestrator ────────────────────────────────────────────────
async def main():
    start_time = time.time()
    logger.info("🚀 Starting VinUni RAG Pipeline...")

    await crawl_and_download()
    convert_to_markdown()
    chunks = chunk_markdown_files()
    index_to_chromadb(chunks)
    verify_pipeline()

    elapsed = time.time() - start_time
    logger.info("=" * 60)
    logger.info(f"🎉 Pipeline finished in {elapsed:.1f} seconds!")
    logger.info("You can now run Streamlit app:")
    logger.info("  .venv\\Scripts\\streamlit.exe run app.py")
    logger.info("=" * 60)

if __name__ == "__main__":
    asyncio.run(main())

