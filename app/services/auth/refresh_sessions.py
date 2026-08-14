"""Refresh token rotation, reuse detection, and revocation."""

from datetime import UTC, datetime

from app.core.exceptions import UnauthorizedError
from app.core.security import REFRESH_TOKEN_TYPE, TokenError, decode_token
from app.db.mongo import Doc, MongoDatabase


async def register_refresh_session(
    db: MongoDatabase,
    *,
    user_id: int,
    jti: str,
    family_id: str,
    remember_me: bool,
    expires_at: datetime,
) -> Doc:
    return await db.insert(
        "refresh_token_sessions",
        {
            "user_id": user_id,
            "jti": jti,
            "family_id": family_id,
            "remember_me": remember_me,
            "revoked_at": None,
            "expires_at": expires_at,
            "created_at": datetime.now(UTC),
        },
    )


async def get_session_by_jti(db: MongoDatabase, jti: str) -> Doc | None:
    return await db.find_one("refresh_token_sessions", {"jti": jti})


async def revoke_family(db: MongoDatabase, family_id: str) -> None:
    await db.update_many(
        "refresh_token_sessions",
        {"family_id": family_id, "revoked_at": None},
        {"revoked_at": datetime.now(UTC)},
    )


async def revoke_jti(db: MongoDatabase, jti: str) -> None:
    session = await get_session_by_jti(db, jti)
    if session and session.revoked_at is None:
        await db.update_one(
            "refresh_token_sessions",
            {"jti": jti, "revoked_at": None},
            {"revoked_at": datetime.now(UTC)},
        )
        session.revoked_at = datetime.now(UTC)


async def revoke_all_for_user(db: MongoDatabase, user_id: int) -> None:
    await db.update_many(
        "refresh_token_sessions",
        {"user_id": user_id, "revoked_at": None},
        {"revoked_at": datetime.now(UTC)},
    )


async def validate_and_rotate(
    db: MongoDatabase,
    refresh_token: str,
) -> tuple[int, bool, str, datetime]:
    """Validate refresh token and mark the old JTI revoked.

    Returns (user_id, remember_me, family_id, expires_at) for issuing a new token.
    Raises UnauthorizedError on invalid, expired, or reused tokens.
    """
    try:
        payload = decode_token(refresh_token, REFRESH_TOKEN_TYPE)
    except TokenError as exc:
        raise UnauthorizedError("Refresh token is invalid or expired.") from exc

    jti = payload.get("jti")
    if not jti:
        raise UnauthorizedError("Refresh token is invalid or expired.")

    user_id = int(payload["sub"])
    remember_me = bool(payload.get("remember_me", False))
    family_id = str(payload.get("family_id", jti))
    exp = payload.get("exp")
    expires_at = datetime.fromtimestamp(exp, tz=UTC) if exp else datetime.now(UTC)

    stored = await get_session_by_jti(db, jti)
    if stored is None:
        raise UnauthorizedError("Refresh token is invalid or expired.")

    if stored.revoked_at is not None:
        # Reuse detection: revoke entire token family.
        await revoke_family(db, stored.family_id)
        raise UnauthorizedError("Refresh token reuse detected. Please sign in again.")

    if stored.user_id != user_id:
        raise UnauthorizedError("Refresh token is invalid or expired.")

    await revoke_jti(db, jti)
    return user_id, remember_me, family_id, expires_at
