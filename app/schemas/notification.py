"""Notification schemas."""

from datetime import datetime

from pydantic import BaseModel


class NotificationRead(BaseModel):
    id: int
    title: str
    message: str
    type: str
    is_read: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class NotificationList(BaseModel):
    items: list[NotificationRead]
    total: int
    unread: int


class NotificationCreate(BaseModel):
    title: str
    message: str
    type: str = "system"
