"""Argon2id password hashing. Never log passwords or hashes in full."""

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError

from campus247.services.errors import validation

_HASHER = PasswordHasher(time_cost=3, memory_cost=65536, parallelism=1, hash_len=32, salt_len=16)
_DUMMY_HASH = _HASHER.hash("campus247-timing-dummy")
MIN_PASSWORD_LENGTH = 10


def hash_password(password: str) -> str:
    return _HASHER.hash(password)


def verify_password(password_hash: str | None, password: str) -> bool:
    target = password_hash or _DUMMY_HASH
    try:
        matched = _HASHER.verify(target, password)
    except (VerifyMismatchError, InvalidHashError, VerificationError):
        return False
    return bool(matched and password_hash)


def validate_new_password(password: str, *, identifier: str | None = None) -> None:
    if len(password) < MIN_PASSWORD_LENGTH:
        raise validation(f"Mật khẩu tối thiểu {MIN_PASSWORD_LENGTH} ký tự.")
    if identifier and password.strip().casefold() == identifier.strip().casefold():
        raise validation("Mật khẩu không được trùng identifier.")
    if password.strip() != password:
        raise validation("Mật khẩu không được bắt đầu hoặc kết thúc bằng khoảng trắng.")
