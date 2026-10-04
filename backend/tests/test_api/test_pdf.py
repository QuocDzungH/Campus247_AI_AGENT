"""Unicode certificate PDF: Vietnamese wrapping, no Latin-1 truncation."""

import re
import zlib

from campus247.services.pdf import (
    CertificateDocument,
    build_certificate_pdf,
    can_state_enrollment,
    confirmation_paragraph,
)

_PDF_ESCAPES = {
    ord("n"): 10,
    ord("r"): 13,
    ord("t"): 9,
    ord("b"): 8,
    ord("f"): 12,
    ord("("): 40,
    ord(")"): 41,
    ord("\\"): 92,
}


def _unescape_pdf_literal(payload: bytes) -> bytes:
    out = bytearray()
    i = 0
    n = len(payload)
    while i < n:
        byte = payload[i]
        if byte != 0x5C:
            out.append(byte)
            i += 1
            continue
        i += 1
        if i >= n:
            break
        nxt = payload[i]
        if nxt in (10, 13):
            if nxt == 13 and i + 1 < n and payload[i + 1] == 10:
                i += 2
            else:
                i += 1
            continue
        if 0x30 <= nxt <= 0x37:
            digits = [nxt]
            i += 1
            while i < n and 0x30 <= payload[i] <= 0x37 and len(digits) < 3:
                digits.append(payload[i])
                i += 1
            out.append(int(bytes(digits), 8) & 0xFF)
            continue
        out.append(_PDF_ESCAPES.get(nxt, nxt))
        i += 1
    return bytes(out)


def _utf16_hex(value: bytes) -> str:
    return bytes.fromhex(value.decode("ascii")).decode("utf-16-be", errors="ignore")


def _parse_tounicode_cmaps(data: bytes) -> list[dict[int, str]]:
    cmaps: list[dict[int, str]] = []
    for block in re.finditer(rb"\d+\s+beginbfchar(.*?)endbfchar", data, re.S):
        mapping = {
            int(src, 16): _utf16_hex(dest)
            for src, dest in re.findall(rb"<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>", block.group(1))
        }
        if mapping:
            cmaps.append(mapping)
    for block in re.finditer(rb"\d+\s+beginbfrange(.*?)endbfrange", data, re.S):
        mapping: dict[int, str] = {}
        for start, end, dest in re.findall(
            rb"<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>", block.group(1)
        ):
            first = int(start, 16)
            last = int(end, 16)
            base = int(dest, 16)
            for offset, gid in enumerate(range(first, last + 1)):
                mapping[gid] = _utf16_hex(f"{base + offset:04X}".encode("ascii"))
        if mapping:
            cmaps.append(mapping)
    return cmaps


def _pdf_streams(data: bytes) -> list[bytes]:
    streams: list[bytes] = []
    for raw in re.findall(rb"stream\r?\n(.*?)\r?\nendstream", data, re.S):
        try:
            streams.append(zlib.decompress(raw))
        except zlib.error:
            streams.append(raw)
    return streams


def _gids_from_literal(payload: bytes) -> list[int]:
    decoded = _unescape_pdf_literal(payload)
    if len(decoded) < 2 or len(decoded) % 2:
        return []
    return [int.from_bytes(decoded[i : i + 2], "big") for i in range(0, len(decoded), 2)]


def _extract(data: bytes) -> str:
    streams = _pdf_streams(data)
    cmaps = _parse_tounicode_cmaps(data + b"\n".join(streams))
    if not cmaps:
        return ""
    chunks: list[str] = []
    for stream in streams:
        for raw in re.findall(rb"\((?:\\.|[^\\)])*\)\s*Tj", stream):
            gids = _gids_from_literal(raw[1 : raw.rfind(b")")])
            if not gids:
                continue
            for cmap in cmaps:
                chunks.append("".join(cmap.get(gid, "") for gid in gids))
    return "\n".join(chunks)


def _contains(data: bytes, text: str) -> bool:
    return text in _extract(data)


def test_confirmation_requires_officer_verified_status():
    imported = CertificateDocument(
        institution_name="VinUniversity",
        title="GIẤY XÁC NHẬN SINH VIÊN",
        signature_status="unsigned",
        kind="draft",
        student_name="Nguyễn Văn An",
        mssv="20210018",
        student_status="Đang học",
        verification_status="imported",
    )
    text = confirmation_paragraph(imported)
    assert "Nguyễn Văn An" in text
    assert "20210018" in text
    assert "Đang học" not in text
    assert can_state_enrollment("imported") is False
    verified = CertificateDocument(
        institution_name="VinUniversity",
        title="GIẤY XÁC NHẬN SINH VIÊN",
        signature_status="unsigned",
        kind="draft",
        student_name="Nguyễn Văn An",
        mssv="20210018",
        student_status="Đang học",
        verification_status="officer_verified",
    )
    assert "Đang học" in confirmation_paragraph(verified)


def test_unicode_pdf_keeps_vietnamese_and_wraps_long_text():
    long_purpose = (
        "Xin giấy xác nhận sinh viên để hoàn thiện hồ sơ vay vốn tại "
        "Ngân hàng Chính sách Xã hội chi nhánh Hà Nội, kèm minh chứng cư trú "
        "và xác nhận thời gian đào tạo theo yêu cầu của bên cho vay. "
    ) * 6
    notes = "Ghi chú nhiều dòng:\n- Dòng một\n- Dòng hai\n" + ("Nội dung dài không được cắt. " * 80)
    doc = CertificateDocument(
        institution_name="VinUniversity",
        institution_unit="Phòng Đào tạo",
        title="GIẤY XÁC NHẬN SINH VIÊN",
        ticket_code="TKT-2026-0099",
        student_name="Nguyễn Văn An",
        mssv="20210018",
        class_year="Khóa 18 (2021 - 2025) · K18 KTPM",
        major="Kỹ thuật Phần mềm",
        faculty="Khoa Kỹ thuật Phần mềm",
        purpose=long_purpose,
        destination_org="Ngân hàng Chính sách Xã hội",
        notes=notes,
        issued_by_name="Trần Thị Hà",
        signature_status="unsigned",
        kind="issued",
        official=False,
    )
    pdf = build_certificate_pdf(doc)
    assert pdf.startswith(b"%PDF-")
    assert b"DejaVu" in pdf or b"DejaVuSans" in pdf
    assert _contains(pdf, "Nguyễn Văn An")
    assert _contains(pdf, "Ngân hàng Chính sách Xã hội")
    assert _contains(pdf, "GIẤY XÁC NHẬN SINH VIÊN")
    assert _contains(pdf, "VinUniversity")
    assert len(pdf) > 4000
    assert b"Latin-1" not in pdf
