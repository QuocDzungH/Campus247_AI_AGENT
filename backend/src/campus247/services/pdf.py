"""Unicode A4 certificate PDF. Vietnamese text wraps and paginates."""

from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

from fpdf import FPDF
from fpdf.enums import XPos, YPos

FONT_DIR = Path(__file__).resolve().parent.parent / "assets" / "fonts"
FONT_REGULAR = FONT_DIR / "DejaVuSans.ttf"
FONT_BOLD = FONT_DIR / "DejaVuSans-Bold.ttf"


@dataclass
class CertificateDocument:
    institution_name: str
    title: str
    signature_status: str
    kind: str
    official: bool = False
    institution_unit: str | None = None
    ticket_code: str | None = None
    student_name: str | None = None
    mssv: str | None = None
    class_year: str | None = None
    major: str | None = None
    faculty: str | None = None
    student_status: str | None = None
    verification_status: str | None = None
    purpose: str | None = None
    destination_org: str | None = None
    notes: str | None = None
    issued_at: str | None = None
    issued_by_name: str | None = None
    valid_until: str | None = None
    document_number: str | None = None
    signing_provider: str | None = None


def _text(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = str(value).strip()
    return cleaned or None


def can_state_enrollment(verification_status: str | None) -> bool:
    return (verification_status or "").strip() == "officer_verified"


def confirmation_paragraph(doc: CertificateDocument) -> str:
    name = _text(doc.student_name)
    mssv = _text(doc.mssv)
    lead = "Nhà trường xác nhận"
    lead += f" sinh viên {name}" if name else " sinh viên theo hồ sơ dưới đây"
    if mssv:
        lead += f", mã số sinh viên {mssv}"
    extras = []
    if _text(doc.class_year):
        extras.append(f"lớp/khóa {doc.class_year.strip()}")
    if _text(doc.major):
        extras.append(f"ngành {doc.major.strip()}")
    if _text(doc.faculty):
        extras.append(f"khoa {doc.faculty.strip()}")
    if extras:
        lead += ", " + ", ".join(extras)
    status = _text(doc.student_status)
    if can_state_enrollment(doc.verification_status) and status:
        lead += f". Tình trạng học tập theo hồ sơ đã được cán bộ xác minh: {status}"
    return lead + "."


def kind_banner(doc: CertificateDocument) -> str:
    if doc.kind == "issued" and doc.signature_status == "unsigned":
        return "Bản hệ thống đã tạo · chưa ký số · chưa phải giấy có giá trị chính thức"
    if doc.kind == "issued" and doc.signature_status == "pending_signature":
        return "Bản hệ thống đã tạo · đang chờ ký số"
    if doc.kind == "issued" and doc.official:
        return "Tài liệu đã phát hành"
    if doc.kind == "issued":
        return "Bản hệ thống đã tạo"
    return "Bản nháp · chưa phát hành"


def notice_text(doc: CertificateDocument) -> str:
    if doc.signature_status == "unsigned" or doc.kind == "draft":
        return "Chưa ký số. Không sử dụng như giấy có giá trị chính thức."
    if doc.signature_status == "pending_signature":
        return "Đang chờ ký số. Chưa phải bản có giá trị chính thức."
    return "Chỉ dùng khi đã hoàn tất ký số theo quy trình nhà trường."


class CertificatePDF(FPDF):
    def __init__(self) -> None:
        super().__init__(format="A4", unit="mm")
        if not FONT_REGULAR.is_file() or not FONT_BOLD.is_file():
            raise FileNotFoundError(f"Missing Unicode fonts in {FONT_DIR}")
        self.add_font("DejaVu", "", str(FONT_REGULAR))
        self.add_font("DejaVu", "B", str(FONT_BOLD))
        self.set_auto_page_break(auto=True, margin=18)
        self.set_margins(18, 16, 18)

    def footer(self) -> None:
        self.set_y(-14)
        self.set_font("DejaVu", "", 8)
        self.set_text_color(90, 90, 90)
        self.cell(0, 8, f"Trang {self.page_no()}/{{nb}}", align="C")


def _write(pdf: FPDF, text: str, *, size: int = 12, bold: bool = False, align: str = "L", height: float = 7) -> None:
    pdf.set_x(pdf.l_margin)
    pdf.set_font("DejaVu", "B" if bold else "", size)
    pdf.multi_cell(0, height, text, align=align, new_x=XPos.LMARGIN, new_y=YPos.NEXT)


def build_certificate_pdf(doc: CertificateDocument) -> bytes:
    pdf = CertificatePDF()
    pdf.alias_nb_pages()
    pdf.add_page()
    pdf.set_text_color(20, 20, 20)
    _write(pdf, doc.institution_name, size=13, bold=True, align="C", height=7)
    if _text(doc.institution_unit):
        _write(pdf, doc.institution_unit, size=11, align="C", height=6)
    pdf.ln(2)
    pdf.set_draw_color(30, 30, 30)
    y = pdf.get_y()
    pdf.line(pdf.l_margin, y, pdf.w - pdf.r_margin, y)
    pdf.set_y(y + 8)
    _write(pdf, doc.title, size=16, bold=True, align="C", height=9)
    pdf.ln(2)
    pdf.set_text_color(90, 70, 20)
    _write(pdf, kind_banner(doc), size=9, align="C", height=5)
    pdf.set_text_color(20, 20, 20)
    pdf.ln(6)
    _write(pdf, confirmation_paragraph(doc), size=12, height=7)
    pdf.ln(4)
    if _text(doc.purpose):
        _write(pdf, "Mục đích", size=11, bold=True, height=6)
        _write(pdf, doc.purpose.strip(), size=12, height=7)
        pdf.ln(2)
    if _text(doc.destination_org):
        _write(pdf, "Cơ quan/đơn vị nhận", size=11, bold=True, height=6)
        _write(pdf, doc.destination_org.strip(), size=12, height=7)
        pdf.ln(2)
    if _text(doc.notes):
        _write(pdf, "Ghi chú", size=11, bold=True, height=6)
        _write(pdf, doc.notes.strip(), size=12, height=7)
        pdf.ln(2)
    meta_lines = []
    if _text(doc.document_number):
        meta_lines.append(f"Số văn bản: {doc.document_number.strip()}")
    if _text(doc.issued_at):
        meta_lines.append(f"Ngày: {doc.issued_at.strip()}")
    if _text(doc.valid_until):
        meta_lines.append(f"Thời hạn: {doc.valid_until.strip()}")
    if _text(doc.ticket_code):
        meta_lines.append(f"Hồ sơ: {doc.ticket_code.strip()}")
    if meta_lines:
        pdf.ln(2)
        for line in meta_lines:
            _write(pdf, line, size=11, height=6)
    pdf.ln(10)
    _write(pdf, "Người có thẩm quyền ký", size=11, bold=True, height=6)
    if doc.signature_status == "signed" and _text(doc.issued_by_name):
        _write(pdf, doc.issued_by_name.strip(), size=11, height=6)
    else:
        pdf.ln(16)
        _write(pdf, "Chưa có chữ ký số.", size=11, height=6)
        if _text(doc.issued_by_name):
            _write(pdf, f"Cán bộ soạn: {doc.issued_by_name.strip()}", size=11, height=6)
        provider = _text(doc.signing_provider)
        if provider and provider != "none":
            _write(pdf, f"Dịch vụ ký: {provider}", size=11, height=6)
    pdf.ln(8)
    _write(pdf, notice_text(doc), size=10, height=6)
    return bytes(pdf.output())


def build_document_pdf(*, title: str, fields: list[tuple[str, str]], notice: str) -> bytes:
    """Compatibility wrapper used by older callers; still Unicode-safe."""
    values = {label: value for label, value in fields}
    doc = CertificateDocument(
        institution_name="VinUniversity",
        institution_unit="Phòng Đào tạo",
        title=title,
        ticket_code=_text(values.get("Mã đơn") or values.get("Ma don")),
        student_name=_text(values.get("Họ tên") or values.get("Ho ten")),
        mssv=_text(values.get("MSSV")),
        class_year=_text(values.get("Khóa") or values.get("Khoa") or values.get("Lớp/khóa")),
        major=_text(values.get("Ngành") or values.get("Nganh")),
        faculty=_text(values.get("Khoa phụ trách")),
        purpose=_text(values.get("Mục đích") or values.get("Muc dich")),
        destination_org=_text(values.get("Nơi nhận") or values.get("Noi nhan")),
        notes=_text(values.get("Ghi chú")),
        issued_by_name=_text(values.get("Cán bộ") or values.get("Can bo")),
        signature_status="unsigned",
        kind="issued",
        official=False,
    )
    return build_certificate_pdf(doc)


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def safe_filename(code: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9._-]+", "-", code).strip("-") or "document"
    return f"{cleaned}.pdf"


def issued_at_label(moment: datetime) -> str:
    return moment.strftime("%Y-%m-%dT%H:%M:%SZ")
