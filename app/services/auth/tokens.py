"""Token issuance and cookie helpers."""

import uuid
from datetime import timedelta

from fastapi import Response

from app.core.config import settings
from app.core.security import (
    REFRESH_TOKEN_TYPE,
    TokenError,
    create_access_token,
    create_refresh_token,
    decode_token,
)
from app.schemas.auth import TokenPair

REFRESH_COOKIE_NAME = "finai_refresh"


def issue_token_pair(user_id: int, *, remember_me: bool, family_id: str | None = None) -> TokenPair:
    fid = family_id or uuid.uuid4().hex
    access = create_access_token(user_id)
    refresh = create_refresh_token(user_id, remember_me=remember_me, family_id=fid)
    return TokenPair(
        access_token=access,
        refresh_token=refresh,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


def set_refresh_cookie(response: Response, refresh_token: str, *, remember_me: bool) -> None:
    max_age = (
        settings.REFRESH_TOKEN_EXPIRE_DAYS_REMEMBER * 86400
        if remember_me
        else settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400
    )
    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value=refresh_token,
        max_age=max_age,
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        path="/api/v1/auth",
    )


def clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(
        key=REFRESH_COOKIE_NAME,
        path="/api/v1/auth",
        secure=settings.cookie_secure,
        httponly=True,
        samesite=settings.cookie_samesite,
    )


def decode_refresh_token(token: str) -> tuple[int, bool]:
    try:
        payload = decode_token(token, REFRESH_TOKEN_TYPE)
        user_id = int(payload["sub"])
        remember_me = bool(payload.get("remember_me", False))
        return user_id, remember_me
    except (TokenError, KeyError, ValueError) as exc:
        raise TokenError("Refresh token is invalid or expired.") from exc


def refresh_expiry(remember_me: bool) -> timedelta:
    days = (
        settings.REFRESH_TOKEN_EXPIRE_DAYS_REMEMBER
        if remember_me
        else settings.REFRESH_TOKEN_EXPIRE_DAYS
    )
    return timedelta(days=days)
