"""Unit tests for security primitives."""

import pytest

from app.core.security import (
    TokenError,
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    require_valid_access_token,
    verify_password,
)


def test_password_never_plaintext():
    hashed = hash_password("strong-password-123")
    assert hashed != "strong-password-123"
    assert "strong-password-123" not in hashed
    assert hashed.startswith("$argon2id$")


def test_password_verify():
    hashed = hash_password("correct horse battery")
    assert verify_password("correct horse battery", hashed) is True
    assert verify_password("wrong password", hashed) is False


def test_salting_different_hashes():
    assert hash_password("same-password") != hash_password("same-password")


def test_short_password_rejected():
    with pytest.raises(ValueError):
        hash_password("short")


def test_access_token_roundtrip():
    token = create_access_token(42)
    user_id = require_valid_access_token(token)
    assert user_id == 42


def test_token_type_enforced():
    refresh = create_refresh_token(7, remember_me=False)
    with pytest.raises(TokenError):
        decode_token(refresh, "access")


def test_refresh_token_roundtrip():
    refresh = create_refresh_token(9, remember_me=True)
    payload = decode_token(refresh, "refresh")
    assert int(payload["sub"]) == 9
    assert payload["remember_me"] is True


def test_expired_token_rejected():
    import jwt
    from datetime import datetime, timedelta, timezone

    from app.core.config import settings

    token = jwt.encode(
        {
            "sub": "1",
            "type": "access",
            "iat": datetime.now(timezone.utc) - timedelta(hours=2),
            "exp": datetime.now(timezone.utc) - timedelta(hours=1),
        },
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )
    with pytest.raises(TokenError):
        decode_token(token, "access")


def test_garbage_token_rejected():
    with pytest.raises(TokenError):
        decode_token("not.a.valid.jwt", "access")
