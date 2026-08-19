"""Notification endpoints."""

from fastapi import APIRouter, Depends

from app.api.dependencies import get_current_user
from app.db.mongo import Doc, MongoDatabase
from app.db.session import get_session
from app.schemas.notification import NotificationCreate, NotificationList, NotificationRead
from app.services.notifications.service import (
    delete_notification,
    list_notifications,
    mark_all_read,
    mark_read,
    notify,
    unread_count,
)

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.post("", response_model=NotificationRead, status_code=201)
async def create_notification(
    data: NotificationCreate,
    user: Doc = Depends(get_current_user),
    db: MongoDatabase = Depends(get_session),
) -> NotificationRead:
    """Create a notification for the current user (system/trigger use)."""
    notification = await notify(db, user.id, data.title, data.message, data.type, dedupe_window_minutes=None)
    return NotificationRead.model_validate(notification)


@router.get("", response_model=NotificationList)
async def get_notifications(
    unread_only: bool = False,
    user: Doc = Depends(get_current_user),
    db: MongoDatabase = Depends(get_session),
) -> NotificationList:
    items = await list_notifications(db, user.id, unread_only=unread_only)
    total = await db.count("notifications", {"user_id": user.id})
    unread = await unread_count(db, user.id)
    return NotificationList(
        items=[NotificationRead.model_validate(n) for n in items],
        total=total,
        unread=unread,
    )


# NOTE: /read-all MUST be registered before /{notification_id}/read
# otherwise FastAPI matches "read-all" as a notification_id and returns 422.
@router.patch("/read-all", response_model=dict)
async def read_all(
    user: Doc = Depends(get_current_user),
    db: MongoDatabase = Depends(get_session),
) -> dict:
    marked = await mark_all_read(db, user.id)
    return {"message": f"Marked {marked} notification(s) as read."}


@router.patch("/{notification_id}/read", response_model=NotificationRead)
async def read_one(
    notification_id: int,
    user: Doc = Depends(get_current_user),
    db: MongoDatabase = Depends(get_session),
) -> NotificationRead:
    notification = await mark_read(db, user.id, notification_id)
    return NotificationRead.model_validate(notification)


@router.delete("/{notification_id}", status_code=200)
async def delete_one(
    notification_id: int,
    user: Doc = Depends(get_current_user),
    db: MongoDatabase = Depends(get_session),
) -> dict:
    await delete_notification(db, user.id, notification_id)
    return {"message": "Notification deleted."}
