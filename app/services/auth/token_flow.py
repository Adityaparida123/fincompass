"""Persist refresh token sessions after issuing token pairs."""

from datetime import UTC, datetime

from app.core.security import refresh_token_metadata
from app.db.mongo import MongoDatabase
from app.schemas.auth import TokenPair
from app.services.auth.refresh_sessions import register_refresh_session
from app.services.auth.tokens import issue_token_pair


async def issue_and_persist_tokens(
    db: MongoDatabase,
    user_id: int,
    *,
    remember_me: bool,
    family_id: str | None = None,
) -> TokenPair:
    tokens = issue_token_pair(user_id, remember_me=remember_me, family_id=family_id)
    meta = refresh_token_metadata(tokens.refresh_token)
    expires_at = datetime.fromtimestamp(meta["exp"], tz=UTC)
    await register_refresh_session(
        db,
        user_id=user_id,
        jti=meta["jti"],
        family_id=meta["family_id"],
        remember_me=remember_me,
        expires_at=expires_at,
    )
    return tokens
