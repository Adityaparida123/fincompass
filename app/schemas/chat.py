"""Chat schemas."""

from datetime import datetime

from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=8000)
    session_id: int | None = None
    language: str | None = Field(default=None, min_length=2, max_length=10)
    detail: str | None = Field(default=None, pattern="^(simple|detailed)$")
    focus: str | None = Field(default=None, pattern="^(business|personal|balanced)$")


class ChatResponse(BaseModel):
    reply: str
    session_id: int
    intent: str | None = None
    tool_used: str | None = None
    tool_result: dict | None = None
    needs_financial_context: bool = False


class StreamChunk(BaseModel):
    delta: str


class ChatSessionCreate(BaseModel):
    title: str | None = Field(default=None, max_length=200)
    language: str | None = Field(default=None, min_length=2, max_length=10)


class ChatSessionRead(BaseModel):
    id: int
    title: str
    language: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ChatMessageRead(BaseModel):
    id: int
    role: str
    content: str
    intent: str | None = None
    tool_used: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}
