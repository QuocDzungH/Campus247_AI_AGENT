"""Minimal PDF 1.4 writer for issued artifacts. Full Unicode stays in the JSON payload."""

from __future__ import annotations

import hashlib
import re
from datetime import datetime


def _pdf_escape(text: str) -> str:
    return text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def _latin(text: str) -> str:
    return text.encode("latin-1", "replace").decode("latin-1")


def build_document_pdf(*, title: str, fields: list[tuple[str, str]], notice: str) -> bytes:
    lines = [title, "Campus 24/7", ""]
    for label, value in fields:
        lines.append(f"{label}: {value}")
    lines.extend(["", notice])
    commands = []
    y = 800
    for line in lines[:52]:
        commands.append(f"BT /F1 11 Tf 48 {y} Td ({_pdf_escape(_latin(line)[:120])}) Tj ET")
        y -= 16
    stream = "\n".join(commands).encode("latin-1", "replace")
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
        b"<< /Length " + str(len(stream)).encode("ascii") + b" >>\nstream\n" + stream + b"\nendstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    out = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for index, body in enumerate(objects, start=1):
        offsets.append(len(out))
        out.extend(f"{index} 0 obj\n".encode("ascii"))
        out.extend(body)
        out.extend(b"\nendobj\n")
    xref = len(out)
    out.extend(f"xref\n0 {len(objects) + 1}\n".encode("ascii"))
    out.extend(b"0000000000 65535 f \n")
    for offset in offsets[1:]:
        out.extend(f"{offset:010d} 00000 n \n".encode("ascii"))
    out.extend(f"trailer << /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode("ascii"))
    return bytes(out)


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def safe_filename(code: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9._-]+", "-", code).strip("-") or "document"
    return f"{cleaned}.pdf"


def issued_at_label(moment: datetime) -> str:
    return moment.strftime("%Y-%m-%dT%H:%M:%SZ")
