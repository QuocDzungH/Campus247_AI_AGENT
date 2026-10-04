from pathlib import Path

from sqlalchemy import func, select

from campus247.db.engine import session_scope
from campus247.db.models import StudentProfile, User
from campus247.services.student_import import import_students_csv
from tests.db_support import upgrade_head


def test_import_csv_dry_run_and_leading_zero(tmp_path):
    url = f"sqlite:///{tmp_path}/import.db"
    upgrade_head(url)
    csv_path = Path(tmp_path) / "students.csv"
    csv_path.write_text(
        "mssv,full_name,email,faculty\n01234567,Nguyen Van A,a@school.test,CNTT\n01234567,Duplicate,b@school.test,CNTT\n",
        encoding="utf-8",
    )
    with session_scope(url) as session:
        dry = import_students_csv(session, csv_path, dry_run=True)
        assert dry.created == 1
        assert any(error.reason == "MSSV trùng trong file." for error in dry.errors)
        assert session.execute(select(func.count()).select_from(StudentProfile)).scalar_one() == 0

    with session_scope(url) as session:
        applied = import_students_csv(session, csv_path, dry_run=False)
        assert applied.created == 1
        profile = session.execute(select(StudentProfile).where(StudentProfile.mssv == "01234567")).scalar_one()
        assert profile.mssv == "01234567"
        assert profile.verification_status == "imported"
        assert profile.is_demo is False
        user = session.get(User, profile.user_id)
        assert user is not None
        assert user.role == "student"
        assert user.username == "01234567"
        assert user.password_hash is None
