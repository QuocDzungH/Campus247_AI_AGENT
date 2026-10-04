"""Admin CLI. Passwords come from getpass or CAMPUS_ADMIN_PASSWORD; never argv."""

from __future__ import annotations

import argparse
import getpass
import os
import sys
from pathlib import Path

from sqlalchemy import select

from campus247.db.engine import session_scope
from campus247.db.identities import load_identities, seed_operational_identities
from campus247.db.models import User
from campus247.services.auth import issue_admin_reset_token, set_password
from campus247.services.common import new_id, utcnow
from campus247.services.identity import find_user_by_identifier
from campus247.services.passwords import hash_password, validate_new_password
from campus247.services.student_import import import_students_csv


def _read_password(prompt: str) -> str:
    env = os.environ.get("CAMPUS_ADMIN_PASSWORD")
    if env:
        return env
    if not sys.stdin.isatty():
        raise SystemExit("Nhập mật khẩu qua CAMPUS_ADMIN_PASSWORD hoặc terminal ẩn.")
    return getpass.getpass(prompt)


def _bootstrap_admin(args: argparse.Namespace) -> int:
    username = args.username or os.environ.get("CAMPUS_ADMIN_USERNAME")
    if not username:
        raise SystemExit("Cần --username hoặc CAMPUS_ADMIN_USERNAME.")
    password = _read_password("Mật khẩu quản trị (không hiện): ")
    validate_new_password(password, identifier=username)
    with session_scope() as session:
        existing = session.execute(select(User).where(User.role == "admin")).scalar_one_or_none()
        if existing is not None:
            raise SystemExit("Đã có tài khoản quản trị. Không tạo thêm bằng bootstrap.")
        if find_user_by_identifier(session, username) is not None:
            raise SystemExit("Identifier đã tồn tại.")
        now = utcnow()
        session.add(
            User(
                id=new_id("adm"),
                role="admin",
                name=args.name or username,
                username=username,
                password_hash=hash_password(password),
                account_status="active",
                password_changed_at=now,
                is_demo=False,
                created_at=now,
                updated_at=now,
            )
        )
        session.commit()
    print("Đã tạo tài khoản quản trị.")
    return 0


def _set_password(args: argparse.Namespace) -> int:
    password = _read_password("Mật khẩu mới (không hiện): ")
    with session_scope() as session:
        user = find_user_by_identifier(session, args.identifier)
        if user is None:
            raise SystemExit("Không tìm thấy người dùng.")
        set_password(session, None, user, password)
    print("Đã đặt mật khẩu. Phiên cũ của tài khoản này đã bị thu hồi.")
    return 0


def _reset_token(args: argparse.Namespace) -> int:
    with session_scope() as session:
        actor = find_user_by_identifier(session, args.admin)
        target = find_user_by_identifier(session, args.identifier)
        if actor is None or actor.role != "admin":
            raise SystemExit("Cần identifier quản trị hợp lệ.")
        if target is None:
            raise SystemExit("Không tìm thấy người dùng.")
        token = issue_admin_reset_token(session, actor, target)
    print("Token một lần (không lưu vào log hệ thống). Hết hạn sau 30 phút.")
    print(token)
    return 0


def _ingest_document(args: argparse.Namespace) -> int:
    from campus247.rag.ingest import ingest_document

    path = Path(args.file)
    if not path.is_file():
        raise SystemExit(f"Không thấy file {path}")
    result = ingest_document(
        path,
        title=args.title or path.stem,
        source=args.source or str(path),
        document_version=args.version or "1",
        effective_from=args.effective_from,
        approved=not args.draft,
    )
    print(result)
    return 0


def _import_students(args: argparse.Namespace) -> int:
    path = Path(args.file)
    if not path.is_file():
        raise SystemExit(f"Không thấy file {path}")
    with session_scope() as session:
        report = import_students_csv(session, path, dry_run=args.dry_run, on_conflict=args.on_conflict)
    print(report.as_dict())
    return 1 if report.errors and not report.created and not report.updated else 0


def _seed_identities(args: argparse.Namespace) -> int:
    path = Path(args.file) if args.file else None
    if path is not None and not path.is_file():
        raise SystemExit(f"Không thấy file {path}")
    with session_scope() as session:
        counts = seed_operational_identities(
            session,
            document=None if path is None else load_identities(path),
            reset_passwords=args.reset_passwords,
        )
    print("Seeded operational identities", counts)
    if args.reset_passwords:
        print("Đã ghi đè mật khẩu các tài khoản vận hành.")
    else:
        print("Mật khẩu hiện có được giữ. Dùng --reset-passwords nếu cần đặt lại.")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="campus247-admin")
    sub = parser.add_subparsers(dest="command", required=True)

    bootstrap = sub.add_parser("bootstrap-admin", help="Tạo admin đầu tiên")
    bootstrap.add_argument("--username")
    bootstrap.add_argument("--name")
    bootstrap.set_defaults(func=_bootstrap_admin)

    password = sub.add_parser("set-password", help="Đặt mật khẩu cho user đã có")
    password.add_argument("--identifier", required=True)
    password.set_defaults(func=_set_password)

    reset = sub.add_parser("issue-reset-token", help="Admin cấp token đặt lại mật khẩu một lần")
    reset.add_argument("--admin", required=True)
    reset.add_argument("--identifier", required=True)
    reset.set_defaults(func=_reset_token)

    importer = sub.add_parser("import-students", help="Import CSV sinh viên")
    importer.add_argument("--file", required=True)
    importer.add_argument("--dry-run", action="store_true")
    importer.add_argument("--on-conflict", choices=("skip", "update"), default="skip")
    importer.set_defaults(func=_import_students)

    ingest = sub.add_parser("ingest-document", help="Nạp tài liệu quy chế vào kho official")
    ingest.add_argument("--file", required=True)
    ingest.add_argument("--title")
    ingest.add_argument("--source")
    ingest.add_argument("--version")
    ingest.add_argument("--effective-from")
    ingest.add_argument("--draft", action="store_true", help="Lưu nhưng chưa phê duyệt retrieval")
    ingest.set_defaults(func=_ingest_document)

    identities = sub.add_parser(
        "seed-identities",
        help="Nạp tài khoản vận hành (hồ sơ + mật khẩu Argon2id, is_demo=False). Không đụng seed demo.",
    )
    identities.add_argument("--file", help="JSON identities; mặc định operational_identities.json")
    identities.add_argument(
        "--reset-passwords",
        action="store_true",
        help="Ghi đè password_hash bằng CAMPUS_SEED_PASSWORD hoặc mật khẩu dev mặc định",
    )
    identities.set_defaults(func=_seed_identities)

    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
