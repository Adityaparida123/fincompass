"""Authentication routes."""

from fastapi import APIRouter, Cookie, Depends, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user, rate_limit_auth
from app.core.exceptions import UnauthorizedError
from app.core.logging import get_logger
from app.core.security import TokenError, refresh_token_metadata
from app.db.models.user import User
from app.db.session import get_session
from app.schemas.auth import (
    AuthResponse,
    ForgotPasswordRequest,
    LoginRequest,
    LogoutRequest,
    MeResponse,
    RefreshRequest,
    RegisterRequest,
    ResetPasswordRequest,
    TokenPair,
)
from app.services.auth import service as auth_service
from app.services.auth.refresh_sessions import (
    revoke_all_for_user,
    revoke_jti,
    validate_and_rotate,
)
from app.services.auth.tokens import (
    REFRESH_COOKIE_NAME,
    clear_refresh_cookie,
    set_refresh_cookie,
)

logger = get_logger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])


def _auth_response(user: User, tokens: TokenPair, remember_me: bool, response: Response) -> AuthResponse:
    set_refresh_cookie(response, tokens.refresh_token, remember_me=remember_me)
    return AuthResponse(user=auth_service.user_summary(user), tokens=tokens)


@router.post("/register", response_model=AuthResponse, status_code=201)
async def register(
    data: RegisterRequest,
    response: Response,
    db: AsyncSession = Depends(get_session),
    _: None = Depends(rate_limit_auth),
) -> AuthResponse:
    user, tokens = await auth_service.register(db, data)
    await db.commit()
    return _auth_response(user, tokens, remember_me=False, response=response)


@router.post("/login", response_model=AuthResponse)
async def login(
    data: LoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_session),
    _: None = Depends(rate_limit_auth),
) -> AuthResponse:
    user, tokens = await auth_service.login(db, data.email, data.password, data.remember_me)
    await db.commit()
    return _auth_response(user, tokens, remember_me=data.remember_me, response=response)


@router.post("/refresh", response_model=TokenPair)
async def refresh(
    data: RefreshRequest,
    response: Response,
    db: AsyncSession = Depends(get_session),
    refresh_cookie: str | None = Cookie(default=None, alias=REFRESH_COOKIE_NAME),
    _: None = Depends(rate_limit_auth),
) -> TokenPair:
    token = data.refresh_token or refresh_cookie
    if not token:
        raise UnauthorizedError("Refresh token missing.")
    user_id, remember_me, family_id, _expires = await validate_and_rotate(db, token)
    tokens = await auth_service.rotate_tokens(db, user_id, remember_me, family_id)
    await db.commit()
    set_refresh_cookie(response, tokens.refresh_token, remember_me=remember_me)
    return tokens


@router.post("/logout", status_code=204)
async def logout(
    response: Response,
    data: LogoutRequest | None = None,
    db: AsyncSession = Depends(get_session),
    refresh_cookie: str | None = Cookie(default=None, alias=REFRESH_COOKIE_NAME),
) -> None:
    token = (data.refresh_token if data else None) or refresh_cookie
    if token:
        try:
            meta = refresh_token_metadata(token)
            await revoke_jti(db, meta["jti"])
            await db.commit()
        except TokenError:
            pass
    clear_refresh_cookie(response)


@router.post("/forgot-password", status_code=200)
async def forgot_password(
    data: ForgotPasswordRequest,
    db: AsyncSession = Depends(get_session),
    _: None = Depends(rate_limit_auth),
) -> dict:
    await auth_service.forgot_password(db, data.email)
    await db.commit()
    return {"message": "If that email exists, a reset link has been issued."}


@router.post("/reset-password", status_code=200)
async def reset_password(
    data: ResetPasswordRequest,
    db: AsyncSession = Depends(get_session),
    _: None = Depends(rate_limit_auth),
) -> dict:
    user = await auth_service.reset_password(db, data.token, data.new_password)
    await revoke_all_for_user(db, user.id)
    await db.commit()
    return {"message": "Password updated successfully."}


@router.get("/me", response_model=MeResponse)
async def me(
    user: User = Depends(get_current_user),
) -> MeResponse:
    return MeResponse(
        user=auth_service.user_summary(user),
        default_currency=user.currency,
        default_timezone=user.timezone,
    )
