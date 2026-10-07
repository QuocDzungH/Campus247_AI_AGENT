"""Populate markdown documents from scraped data and build ChromaDB index."""
import os
import re
import sys
import hashlib
from pathlib import Path
from typing import Dict, Any, List
import chromadb
from chromadb.utils.embedding_functions import OpenAIEmbeddingFunction
from langchain_text_splitters import RecursiveCharacterTextSplitter
import yaml

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

BASE_DIR = Path(__file__).resolve().parent
PROCESSED_DIR = BASE_DIR / "data" / "processed"
LEGAL_DIR = BASE_DIR / "data" / "landing" / "legal"
VECTORSTORE_DIR = BASE_DIR / "vectorstore"

PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
VECTORSTORE_DIR.mkdir(parents=True, exist_ok=True)

# Load env
for env_f in [BASE_DIR / ".env", BASE_DIR.parent / ".env"]:
    if env_f.exists():
        with open(env_f, encoding="utf-8") as f:
            for line in f:
                if "=" in line and not line.strip().startswith("#"):
                    k, _, v = line.strip().partition("=")
                    os.environ.setdefault(k.strip(), v.strip().strip("'\""))

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")

# Mapping of source_id to scraped file path
SCRAPED_SOURCES = {
    "request_transcripts": {
        "path": r"C:\Users\dungh\.gemini\antigravity\brain\18ec64c1-6082-4bc0-8a8e-e95336b3d2c1\.system_generated\steps\233\content.md",
        "title": "Request Transcripts & Certifications - Registrar",
        "url": "https://registrar.vinuni.edu.vn/academics/request-transcripts-certifications/",
        "category": "xin_giay_to",
        "doc_type": "policy",
    },
    "document_request_form": {
        "path": r"C:\Users\dungh\.gemini\antigravity\brain\18ec64c1-6082-4bc0-8a8e-e95336b3d2c1\.system_generated\steps\233\content.md",
        "title": "Student Document Request Form Guidance",
        "url": "https://forms.office.com/pages/responsepage.aspx?id=iSf4WJVmSk-r2zV2aNVc_0dbBYw8WtJPgbnOOjH80gpUNDRJUExIOEoxQzA0RE9CRE9XWVM1M0QxSS4u&route=shorturl",
        "category": "xin_giay_to",
        "doc_type": "form",
    },
    "escalation_procedure": {
        "path": r"C:\Users\dungh\.gemini\antigravity\brain\18ec64c1-6082-4bc0-8a8e-e95336b3d2c1\.system_generated\steps\231\content.md",
        "title": "Formal Escalation Management Procedure for Students' Complaint",
        "url": "https://policy.vinuni.edu.vn/all-policies/formal-escalation-management-procedure-for-students/",
        "category": "khieu_nai",
        "doc_type": "policy",
    },
    "academic_regulations": {
        "path": r"C:\Users\dungh\.gemini\antigravity\brain\18ec64c1-6082-4bc0-8a8e-e95336b3d2c1\.system_generated\steps\235\content.md",
        "title": "Academic Regulations for Full-Time Undergraduate Programs",
        "url": "https://policy.vinuni.edu.vn/all-policies/academic-regulations-for-full-time-undergraduate-programs/",
        "category": "phuc_khao",
        "doc_type": "policy",
    },
    "academic_integrity": {
        "path": r"C:\Users\dungh\.gemini\antigravity\brain\18ec64c1-6082-4bc0-8a8e-e95336b3d2c1\.system_generated\steps\237\content.md",
        "title": "Student Academic Integrity Policy",
        "url": "https://policy.vinuni.edu.vn/all-policies/student-academic-integrity/",
        "category": "liem_chinh",
        "doc_type": "policy",
    },
    "code_of_conduct": {
        "path": r"C:\Users\dungh\.gemini\antigravity\brain\18ec64c1-6082-4bc0-8a8e-e95336b3d2c1\.system_generated\steps\239\content.md",
        "title": "Student Affairs Regulations - Code of Conduct",
        "url": "https://policy.vinuni.edu.vn/all-policies/student-affairs-regulations-code-of-conduct/",
        "category": "ung_xu_ky_luat",
        "doc_type": "policy",
    },
    "residential_life": {
        "path": r"C:\Users\dungh\.gemini\antigravity\brain\18ec64c1-6082-4bc0-8a8e-e95336b3d2c1\.system_generated\steps\241\content.md",
        "title": "Residential Life Guideline - Dormitory Rules",
        "url": "https://policy.vinuni.edu.vn/all-policies/residential-life-guideline/",
        "category": "ky_tuc_xa",
        "doc_type": "policy",
    },
    "library_policy": {
        "path": r"C:\Users\dungh\.gemini\antigravity\brain\18ec64c1-6082-4bc0-8a8e-e95336b3d2c1\.system_generated\steps\243\content.md",
        "title": "Library Access & Services Policy",
        "url": "https://policy.vinuni.edu.vn/all-policies/library-policies-for-users/",
        "category": "thu_vien",
        "doc_type": "policy",
    },
    "facility_usage": {
        "path": r"C:\Users\dungh\.gemini\antigravity\brain\18ec64c1-6082-4bc0-8a8e-e95336b3d2c1\.system_generated\steps\245\content.md",
        "title": "Facility Usage Regulations",
        "url": "https://policy.vinuni.edu.vn/all-policies/facility-usage-regulations-including-facilities-for-rent/",
        "category": "co_so_vat_chat",
        "doc_type": "policy",
    },
    "room_bookings": {
        "path": r"C:\Users\dungh\.gemini\antigravity\brain\18ec64c1-6082-4bc0-8a8e-e95336b3d2c1\.system_generated\steps\247\content.md",
        "title": "Room Bookings Regulations - Registrar",
        "url": "https://registrar.vinuni.edu.vn/internal-services/room-bookings/",
        "category": "dat_phong",
        "doc_type": "policy",
    },
}

def clean_markdown_body(raw_text: str) -> str:
    lines = raw_text.splitlines()
    body_lines = []
    skip_header = True
    for line in lines:
        if skip_header:
            if line.strip() == "---":
                skip_header = False
            continue
        body_lines.append(line)
    return "\n".join(body_lines).strip()

def prepare_markdown_files():
    print("[1/4] Preparing Markdown files in data/processed/...")
    count = 0
    for sid, info in SCRAPED_SOURCES.items():
        src_path = Path(info["path"])
        if not src_path.exists():
            continue

        raw = src_path.read_text(encoding="utf-8")
        body = clean_markdown_body(raw)

        frontmatter = (
            f"---\n"
            f"source: \"{sid}\"\n"
            f"title: \"{info['title']}\"\n"
            f"url: \"{info['url']}\"\n"
            f"doc_type: \"{info['doc_type']}\"\n"
            f"category: \"{info['category']}\"\n"
            f"---\n\n"
        )
        dest = PROCESSED_DIR / f"{sid}.md"
        dest.write_text(frontmatter + body, encoding="utf-8")
        count += 1
        print(f"  [+] Saved {dest.name} ({len(body)} chars)")

    # Extract text from Escalation PDF
    pdf_path = LEGAL_DIR / "escalation_pdf.pdf"
    if pdf_path.exists():
        try:
            import pypdf
            reader = pypdf.PdfReader(str(pdf_path))
            pdf_text = "\n\n".join(page.extract_text() or "" for page in reader.pages)
            if pdf_text.strip():
                pdf_md = (
                    f"---\n"
                    f"source: \"escalation_pdf\"\n"
                    f"title: \"Formal Escalation Management Procedure for Students V2.0 PDF\"\n"
                    f"url: \"https://policy.vinuni.edu.vn/wp-content/uploads/2025/02/20251224_GDL-SAM-007-V2.0_Formal-Escalation-Management-Procedure-for-Students.pdf\"\n"
                    f"doc_type: \"legal\"\n"
                    f"category: \"khieu_nai\"\n"
                    f"---\n\n"
                    + pdf_text
                )
                dest = PROCESSED_DIR / "escalation_pdf.md"
                dest.write_text(pdf_md, encoding="utf-8")
                count += 1
                print(f"  [+] Saved PDF text to {dest.name} ({len(pdf_text)} chars)")
        except Exception as e:
            print(f"  [!] Could not parse PDF: {e}")

    print(f"Total processed documents: {count}")

def chunk_all_documents() -> List[Dict[str, Any]]:
    print("\n[2/4] Chunking documents with RecursiveCharacterTextSplitter...")
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=700,
        chunk_overlap=150,
        separators=["\n## ", "\n### ", "\n\n", "\n", " ", ""]
    )
    chunks = []
    for md_f in sorted(PROCESSED_DIR.glob("*.md")):
        raw = md_f.read_text(encoding="utf-8")
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

        sid = meta.get("source", md_f.stem)
        title = meta.get("title", sid)
        url = meta.get("url", "")
        doc_type = meta.get("doc_type", "policy")
        category = meta.get("category", "general")

        sub_texts = splitter.split_text(body)
        for idx, text in enumerate(sub_texts):
            cid = f"{sid}_chunk_{idx}"
            chunks.append({
                "id": cid,
                "content": text.strip(),
                "metadata": {
                    "source": sid,
                    "title": title,
                    "url": url,
                    "doc_type": doc_type,
                    "category": category,
                    "chunk_index": idx,
                }
            })
    print(f"Total chunks generated: {len(chunks)}")
    return chunks

def index_to_chroma(chunks: List[Dict[str, Any]]):
    print("\n[3/4] Indexing chunks to ChromaDB with OpenAI text-embedding-3-small...")
    ef = OpenAIEmbeddingFunction(
        api_key=OPENAI_API_KEY,
        model_name="text-embedding-3-small"
    )
    client = chromadb.PersistentClient(path=str(VECTORSTORE_DIR))
    try:
        client.delete_collection("vinuni_docs")
    except Exception:
        pass

    collection = client.create_collection(
        name="vinuni_docs",
        embedding_function=ef,
        metadata={"hnsw:space": "cosine"}
    )

    BATCH = 80
    for i in range(0, len(chunks), BATCH):
        batch = chunks[i : i + BATCH]
        collection.upsert(
            ids=[c["id"] for c in batch],
            documents=[c["content"] for c in batch],
            metadatas=[c["metadata"] for c in batch],
        )
        print(f"  Indexed batch {i // BATCH + 1} ({len(batch)} chunks)")

    print(f"Successfully indexed {collection.count()} chunks in ChromaDB!")

def test_queries():
    print("\n[4/4] Verifying search with test queries...")
    ef = OpenAIEmbeddingFunction(
        api_key=OPENAI_API_KEY,
        model_name="text-embedding-3-small"
    )
    client = chromadb.PersistentClient(path=str(VECTORSTORE_DIR))
    coll = client.get_collection("vinuni_docs", embedding_function=ef)

    queries = [
        "Lam the nao de xin bang diem transcript va giay xac nhan sinh vien?",
        "Quy trinh xu ly khieu nai escalation management procedure cua sinh vien VinUni?",
        "Quy dinh ve gio yen tinh tai ky tuc xa?",
        "Quy dinh muon sach va thoi gian mo cua thu vien?",
    ]

    for q in queries:
        print("\n" + "=" * 55)
        print(f"Query: {q}")
        res = coll.query(query_texts=[q], n_results=2)
        if res and res["documents"] and res["documents"][0]:
            for r, (doc, meta, dist) in enumerate(zip(res["documents"][0], res["metadatas"][0], res["distances"][0]), 1):
                sim = 1.0 - dist
                title = meta.get('title', 'Unknown')
                cat = meta.get('category', 'General')
                snippet = doc.replace('\n', ' ')[:120]
                print(f"  [Top {r}] Sim: {sim:.3f} | Title: {title} ({cat})")
                print(f"          Snippet: {snippet}...")

if __name__ == "__main__":
    prepare_markdown_files()
    chunks = chunk_all_documents()
    index_to_chroma(chunks)
    test_queries()
    print("\n>>> ALL PIPELINE STAGES COMPLETED SUCCESSFULLY! <<<")
