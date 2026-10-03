"""CSV import for student identity. Does not invent rows or mark them as verified students."""

from __future__ import annotations

import csv
from dataclasses import dataclass, field
from io import StringIO
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from campus247.db.models import StudentProfile, User
from campus247.services.common import new_id, utcnow
from campus247.services.identity import normalize_identifier

REQUIRED = ("mssv", "full_name")
OPTIONAL = ("email", "faculty", "major", "cohort", "class_year", "student_status")


@dataclass
class ImportRowError:
    line: int
    mssv: str | None
    reason: str


@dataclass
class ImportReport:
    dry_run: bool
    created: int = 0
    updated: int = 0
    skipped: int = 0
    errors: list[ImportRowError] = field(default_factory=list)

    def as_dict(self) -> dict:
        return {
            "dry_run": self.dry_run,
            "created": self.created,
            "updated": self.updated,
            "skipped": self.skipped,
            "errors": [error.__dict__ for error in self.errors],
        }


def _read_rows(path: Path) -> tuple[list[dict[str, str]], list[ImportRowError]]:
    text = path.read_text(encoding="utf-8-sig")
    reader = csv.DictReader(StringIO(text))
    if reader.fieldnames is None:
        return [], [ImportRowError(line=1, mssv=None, reason="File CSV không có header.")]
    headers = {name.strip(): name for name in reader.fieldnames if name}
    missing = [column for column in REQUIRED if column not in headers]
    errors: list[ImportRowError] = []
    if missing:
        errors.append(ImportRowError(line=1, mssv=None, reason=f"Thiếu cột bắt buộc: {', '.join(missing)}."))
        return [], errors
    rows: list[dict[str, str]] = []
    seen: set[str] = set()
    for index, raw in enumerate(reader, start=2):
        record = {key: (raw.get(headers[key]) or "").strip() for key in [*REQUIRED, *OPTIONAL] if key in headers}
        mssv = normalize_identifier(record.get("mssv", ""))
        if not mssv:
            errors.append(ImportRowError(line=index, mssv=None, reason="MSSV trống."))
            continue
        if mssv in seen:
            errors.append(ImportRowError(line=index, mssv=mssv, reason="MSSV trùng trong file."))
            continue
        seen.add(mssv)
        record["mssv"] = mssv
        if not record.get("full_name"):
            errors.append(ImportRowError(line=index, mssv=mssv, reason="Thiếu họ tên."))
            continue
        rows.append(record)
    return rows, errors


def import_students_csv(session: Session, path: Path, *, dry_run: bool, on_conflict: str = "skip") -> ImportReport:
    if on_conflict not in {"skip", "update"}:
        raise ValueError("on_conflict must be skip or update")
    rows, errors = _read_rows(path)
    report = ImportReport(dry_run=dry_run, errors=errors)
    if errors and not rows:
        return report
    now = utcnow()
    for record in rows:
        profile = session.execute(select(StudentProfile).where(StudentProfile.mssv == record["mssv"])).scalar_one_or_none()
        if profile is None:
            report.created += 1
            if dry_run:
                continue
            user = User(
                id=new_id("usr"),
                role="student",
                name=record["full_name"],
                email=record.get("email") or None,
                account_status="active",
                is_demo=False,
                created_at=now,
                updated_at=now,
            )
            session.add(user)
            session.flush()
            session.add(
                StudentProfile(
                    user_id=user.id,
                    full_name=record["full_name"],
                    mssv=record["mssv"],
                    email=record.get("email") or None,
                    faculty=record.get("faculty") or None,
                    major=record.get("major") or None,
                    cohort=record.get("cohort") or None,
                    class_year=record.get("class_year") or None,
                    student_status=record.get("student_status") or None,
                    verification_status="imported",
                    source=str(path),
                    source_imported_at=now,
                    is_demo=False,
                    created_at=now,
                    updated_at=now,
                )
            )
            continue
        if on_conflict == "skip":
            report.skipped += 1
            continue
        report.updated += 1
        if dry_run:
            continue
        profile.full_name = record["full_name"]
        profile.email = record.get("email") or profile.email
        profile.faculty = record.get("faculty") or profile.faculty
        profile.major = record.get("major") or profile.major
        profile.cohort = record.get("cohort") or profile.cohort
        profile.class_year = record.get("class_year") or profile.class_year
        profile.student_status = record.get("student_status") or profile.student_status
        profile.source = str(path)
        profile.source_imported_at = now
        if profile.verification_status == "unverified":
            profile.verification_status = "imported"
        profile.updated_at = now
        profile.user.name = record["full_name"]
        profile.user.updated_at = now
    if not dry_run:
        session.commit()
    else:
        session.rollback()
    return report
