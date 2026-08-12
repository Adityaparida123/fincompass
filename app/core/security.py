"""Security primitives: Argon2id password hashing and JWT tokens.

Passwords are never stored or logged in plaintext. Access tokens are
short-lived; refresh tokens are longer-lived and rotated on use.
"""

import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError

from app.core.config import settings
from app.core.exceptions import UnauthorizedError

_password_hasher = PasswordHasher(
    memory_cost=65536,  # 64 MiB
    time_cost=3,
    parallelism=4,
)

ACCESS_TOKEN_TYPE = "access"
REFRESH_TOKEN_TYPE = "refresh"


class TokenError(Exception):
    """Raised when a token is invalid, expired, or of the wrong type."""


def hash_password(password: str) -> str:
    if not password or len(password) < 8:
        raise ValueError("Password must be at least 8 characters long.")
    return _password_hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return _password_hasher.verify(password_hash, password)
    except (VerifyMismatchError, TypeError, ValueError):
        return False


def create_token(
    subject: str,
    token_type: str,
    expires_delta: timedelta,
    *,
    extra: dict[str, Any] | None = None,
) -> str:
    now = datetime.now(timezone.utc)
    payload: dict[str, Any] = {
        "sub": subject,
        "type": token_type,
        "iat": now,
        "exp": now + expires_delta,
        "jti": secrets.token_urlsafe(16),
    }
    if extra:
        payload.update(extra)
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_access_token(user_id: int) -> str:
    return create_token(
        str(user_id),
        ACCESS_TOKEN_TYPE,
        timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )


def create_refresh_token(user_id: int, *, remember_me: bool) -> str:
    days = (
        settings.REFRESH_TOKEN_EXPIRE_DAYS_REMEMBER
        if remember_me
        else settings.REFRESH_TOKEN_EXPIRE_DAYS
    )
    return create_token(
        str(user_id),
        REFRESH_TOKEN_TYPE,
        timedelta(days=days),
        extra={"remember_me": remember_me},
    )


def decode_token(token: str, expected_type: str) -> dict[str, Any]:
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
    except jwt.ExpiredSignatureError as exc:
        raise TokenError("Token has expired.") from exc
    except jwt.InvalidTokenError as exc:
        raise TokenError("Token is invalid.") from exc

    if payload.get("type") != expected_type:
        raise TokenError(f"Expected a {expected_type} token.")
    return payload


def require_valid_access_token(token: str) -> int:
    try:
        payload = decode_token(token, ACCESS_TOKEN_TYPE)
        return int(payload["sub"])
    except (TokenError, KeyError, ValueError) as exc:
        raise UnauthorizedError("Authentication required.") from exc
