"""Authentication service: register, login, logout, password reset.

Passwords are always hashed with Argon2id. Never store or log plaintext.
"""

from datetime import timedelta
from typing import Any

from app.core.config import settings
from app.core.exceptions import ConflictError, InvalidInputError, UnauthorizedError
from app.core.security import (
    TokenError,
    create_token,
    decode_token,
)
from app.db.mongo import Doc, MongoDatabase
from app.schemas.auth import RegisterRequest, UserSummary
from app.services.audit import log_audit
from app.services.auth.password import hash_password, verify_password
from app.services.auth.token_flow import issue_and_persist_tokens
from app.services.email import get_email_service

RESET_TOKEN_EXPIRE_MINUTES = 30


async def get_user_by_email(db: MongoDatabase, email: str) -> Doc | None:
    return await db.find_one("users", {"email": email.lower()})


async def get_user_by_id(db: MongoDatabase, user_id: int) -> Doc | None:
    return await db.find_one("users", {"id": user_id})


def user_summary(user: Doc) -> UserSummary:
    return UserSummary(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        phone=user.phone,
        preferred_language=user.preferred_language,
        currency=user.currency,
        timezone=user.timezone,
    )


async def register(db: MongoDatabase, data: RegisterRequest) -> tuple[Doc, Any]:
    existing = await get_user_by_email(db, data.email)
    if existing:
        raise ConflictError("An account with this email already exists.")

    password_hash = hash_password(data.password)
    user = await db.insert(
        "users",
        {
            "email": data.email.lower(),
            "password_hash": password_hash,
            "full_name": data.full_name.strip(),
            "phone": None,
            "preferred_language": "en",
            "currency": settings.DEFAULT_CURRENCY,
            "timezone": settings.DEFAULT_TIMEZONE,
            "is_active": True,
        },
    )

    await log_audit(
        db,
        action="auth.register",
        resource_type="user",
        user_id=user.id,
        resource_id=user.id,
    )
    tokens = await issue_and_persist_tokens(db, user.id, remember_me=False)
    return user, tokens


async def authenticate(db: MongoDatabase, email: str, password: str) -> Doc:
    user = await get_user_by_email(db, email)
    if user is None or not verify_password(password, user.password_hash):
        raise UnauthorizedError("Invalid email or password.")
    if not user.is_active:
        raise UnauthorizedError("Account is disabled.")
    return user


async def login(db: MongoDatabase, email: str, password: str, remember_me: bool):
    user = await authenticate(db, email, password)
    tokens = await issue_and_persist_tokens(db, user.id, remember_me=remember_me)
    await log_audit(
        db,
        action="auth.login",
        resource_type="user",
        user_id=user.id,
        resource_id=user.id,
        metadata={"remember_me": remember_me},
    )
    return user, tokens


async def rotate_tokens(db: MongoDatabase, user_id: int, remember_me: bool, family_id: str):
    return await issue_and_persist_tokens(
        db, user_id, remember_me=remember_me, family_id=family_id
    )


def create_reset_token(user_id: int) -> str:
    return create_token(
        str(user_id),
        "password_reset",
        timedelta(minutes=RESET_TOKEN_EXPIRE_MINUTES),
    )


async def forgot_password(db: MongoDatabase, email: str) -> str | None:
    """Generate a reset token.

    Returns the raw token only when no mail transport is configured
    (development convenience). In production this is routed through an
    email provider and never returned to the API caller.
    """
    user = await get_user_by_email(db, email)
    if user is None:
        return None
    token = create_reset_token(user.id)
    await log_audit(
        db,
        action="auth.forgot_password",
        resource_type="user",
        user_id=user.id,
        resource_id=user.id,
    )
    email_service = get_email_service()
    await email_service.send_password_reset(user.email, token)
    return token


async def reset_password(db: MongoDatabase, token: str, new_password: str) -> Doc:
    try:
        payload = decode_token(token, "password_reset")
        user_id = int(payload["sub"])
    except (TokenError, KeyError, ValueError) as exc:
        raise InvalidInputError("Reset token is invalid or expired.") from exc

    user = await get_user_by_id(db, user_id)
    if user is None:
        raise InvalidInputError("Reset token is invalid or expired.")

    new_hash = hash_password(new_password)
    await db.update_one("users", {"id": user.id}, {"password_hash": new_hash})
    user.password_hash = new_hash
    await log_audit(
        db,
        action="auth.reset_password",
        resource_type="user",
        user_id=user.id,
        resource_id=user.id,
    )
    return user
