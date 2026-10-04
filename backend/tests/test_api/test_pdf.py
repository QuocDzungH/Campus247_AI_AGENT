"""Unicode certificate PDF: Vietnamese wrapping, no Latin-1 truncation."""

import shutil
import subprocess
import tempfile
from pathlib import Path

from campus247.services.pdf import (
    CertificateDocument,
    build_certificate_pdf,
    can_state_enrollment,
    confirmation_paragraph,
)


def _extract(data: bytes) -> str:
    pdftotext = shutil.which("pdftotext")
    if not pdftotext:
        raise RuntimeError("pdftotext is required to verify Unicode PDF text")
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / "doc.pdf"
        path.write_bytes(data)
        result = subprocess.run(
            [pdftotext, "-layout", str(path), "-"],
            check=True,
            capture_output=True,
        )
        return result.stdout.decode("utf-8", errors="replace")


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
