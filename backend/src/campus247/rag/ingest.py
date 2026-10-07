"""Ingest approved regulation files into the official corpus index. Does not invent policy text."""

from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path

from campus247.config import get_settings
from campus247.services.common import new_id


def _read_text(path: Path) -> str:
    suffix = path.suffix.lower()
    if suffix in {".txt", ".md", ".html", ".htm"}:
        return path.read_text(encoding="utf-8")
    if suffix == ".pdf":
        try:
            from pypdf import PdfReader
        except ImportError as exc:
            raise SystemExit("Cần pypdf để đọc PDF, hoặc chuyển tài liệu sang .txt/.md.") from exc
        reader = PdfReader(str(path))
        pages = []
        for index, page in enumerate(reader.pages, start=1):
            text = (page.extract_text() or "").strip()
            if text:
                pages.append(f"[Trang {index}]\n{text}")
        return "\n\n".join(pages)
    raise SystemExit(f"Định dạng chưa hỗ trợ: {suffix}. Dùng txt, md, html hoặc pdf.")


def ingest_document(
    path: Path,
    *,
    title: str,
    source: str,
    document_version: str,
    effective_from: str | None,
    approved: bool,
) -> dict:
    text = _read_text(path).strip()
    if not text:
        raise SystemExit("Tài liệu không có nội dung chữ để index.")
    settings = get_settings()
    root = Path(settings.official_corpus_dir)
    root.mkdir(parents=True, exist_ok=True)
    index_path = root / "index.json"
    if index_path.is_file():
        corpus = json.loads(index_path.read_text(encoding="utf-8"))
    else:
        corpus = {
            "corpus_id": "campus247-official",
            "index_version": "official-v1",
            "is_demo": False,
            "provenance": "Operator-ingested documents. Only approved items are retrieved.",
            "allowed_scopes": ["academic"],
            "documents": [],
        }
    document_id = new_id("doc")
    chunks = []
    paragraphs = [part.strip() for part in text.split("\n\n") if part.strip()]
    for index, paragraph in enumerate(paragraphs, start=1):
        chunks.append(
            {
                "chunk_id": f"{document_id}-c{index:03d}",
                "locator": f"Mục {index}",
                "text": paragraph[:8000],
            }
        )
    document = {
        "document_id": document_id,
        "document_title": title,
        "document_version": document_version,
        "policy_scope": "academic",
        "effective_from": effective_from or datetime.now(UTC).isoformat(),
        "effective_to": None,
        "approved": approved,
        "is_demo": False,
        "source": source,
        "url": None,
        "chunks": chunks,
    }
    corpus["documents"].append(document)
    corpus["index_version"] = f"official-v{len(corpus['documents'])}"
    index_path.write_text(json.dumps(corpus, ensure_ascii=False, indent=2), encoding="utf-8")
    return {"document_id": document_id, "chunks": len(chunks), "index_version": corpus["index_version"]}
