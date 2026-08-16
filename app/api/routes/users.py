"""User profile routes."""

from fastapi import APIRouter, Depends

from app.api.dependencies import get_current_user
from app.core.exceptions import ConflictError
from app.db.mongo import Doc, MongoDatabase
from app.db.session import get_session
from app.schemas.auth import UserSummary
from app.schemas.user import UserProfileUpdate
from app.services.audit import log_audit
from app.services.auth.service import get_user_by_email, get_user_by_id, user_summary

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserSummary)
async def get_me(user: Doc = Depends(get_current_user)) -> UserSummary:
    return user_summary(user)


@router.patch("/me", response_model=UserSummary)
async def update_me(
    data: UserProfileUpdate,
    user: Doc = Depends(get_current_user),
    db: MongoDatabase = Depends(get_session),
) -> UserSummary:
    updates = data.model_dump(exclude_unset=True, exclude_none=True)
    if "email" in updates and updates["email"] != user.email:
        existing = await get_user_by_email(db, updates["email"])
        if existing and existing.id != user.id:
            raise ConflictError("An account with this email already exists.")
        updates["email"] = updates["email"].lower()
    await db.update_one("users", {"id": user.id}, updates)
    await log_audit(
        db,
        action="user.update_profile",
        resource_type="user",
        user_id=user.id,
        resource_id=user.id,
        metadata={"fields": sorted(updates.keys())},
    )
    updated = await get_user_by_id(db, user.id)
    return user_summary(updated)


@router.delete("/me", status_code=200)
async def delete_me(
    user: Doc = Depends(get_current_user),
    db: MongoDatabase = Depends(get_session),
) -> dict:
    """Permanently delete the current account and all associated data."""
    from app.services.users.service import delete_account

    await log_audit(
        db,
        action="user.delete_account",
        resource_type="user",
        user_id=user.id,
        resource_id=user.id,
    )
    await delete_account(db, user)
    return {"message": "Account deleted."}
