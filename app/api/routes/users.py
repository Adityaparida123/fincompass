"""User profile routes."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user
from app.db.models.user import User
from app.db.session import get_session
from app.schemas.auth import UserSummary
from app.schemas.user import UserProfileUpdate
from app.services.audit import log_audit
from app.services.auth.service import get_user_by_email, user_summary

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserSummary)
async def get_me(user: User = Depends(get_current_user)) -> UserSummary:
    return user_summary(user)


@router.patch("/me", response_model=UserSummary)
async def update_me(
    data: UserProfileUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> UserSummary:
    updates = data.model_dump(exclude_unset=True, exclude_none=True)
    if "email" in updates and updates["email"] != user.email:
        existing = await get_user_by_email(db, updates["email"])
        if existing and existing.id != user.id:
            from app.core.exceptions import ConflictError

            raise ConflictError("An account with this email already exists.")
        updates["email"] = updates["email"].lower()
    for field, value in updates.items():
        setattr(user, field, value)
    await log_audit(
        db,
        action="user.update_profile",
        resource_type="user",
        user_id=user.id,
        resource_id=user.id,
        metadata={"fields": sorted(updates.keys())},
    )
    await db.commit()
    return user_summary(user)
