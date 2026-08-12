"""FinAI chat endpoints."""

import json

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.agent import chat, get_provider
from app.ai.memory import (
    add_message,
    create_session,
    delete_session,
    get_messages,
    get_session,
    list_sessions,
)
from app.ai.prompts import build_messages
from app.api.dependencies import get_current_user, rate_limit_chat
from app.db.models.consent import ConsentType
from app.db.models.user import User
from app.db.session import get_session as get_db
from app.schemas.chat import (
    ChatMessageRead,
    ChatRequest,
    ChatResponse,
    ChatSessionRead,
)
from app.services.consent.service import require_consent

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("", response_model=ChatResponse)
async def post_chat(
    data: ChatRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _: None = Depends(rate_limit_chat),
) -> ChatResponse:
    return await chat(db, user.id, data.message, session_id=data.session_id, language=data.language)


@router.post("/stream")
async def stream_chat(
    data: ChatRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _: None = Depends(rate_limit_chat),
) -> StreamingResponse:
    from app.ai.memory import to_llm_history
    from app.ai.router import route_intent

    routing = route_intent(data.message)
    needs_context = bool(routing["needs_context"])
    if needs_context:
        await require_consent(db, user.id, ConsentType.financial_data_analysis)
        await require_consent(db, user.id, ConsentType.chat_financial_context)

    session = None
    if data.session_id:
        session = await get_session(db, user.id, data.session_id)
    else:
        session = await create_session(db, user.id, title=data.message[:60])
    await add_message(db, session.id, "user", data.message, intent=str(routing["intent"]))

    history = await get_messages(db, session.id)
    llm_history = to_llm_history(history)
    if llm_history and llm_history[-1]["role"] == "user":
        llm_history = llm_history[:-1]

    context_text = None
    if needs_context:
        from app.ai.agent import _financial_context

        context_text = await _financial_context(db, user.id)

    messages = build_messages(llm_history, financial_context=context_text)
    provider = get_provider()

    async def event_generator():
        collected: list[str] = []
        try:
            async for chunk in provider.generate_stream(messages):
                collected.append(chunk)
                yield f"data: {json.dumps({'delta': chunk}, ensure_ascii=False)}\n\n"
        except Exception:
            yield "data: {\"delta\": \"\"}\n\n"
        finally:
            full = "".join(collected)
            await add_message(db, session.id, "assistant", full, intent=str(routing["intent"]))
            await db.commit()
            yield "data: [DONE]\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.get("/sessions", response_model=list[ChatSessionRead])
async def get_chat_sessions(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ChatSessionRead]:
    sessions = await list_sessions(db, user.id)
    return [ChatSessionRead.model_validate(s) for s in sessions]


@router.get("/sessions/{session_id}", response_model=list[ChatMessageRead])
async def get_chat_session(
    session_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ChatMessageRead]:
    await get_session(db, user.id, session_id)
    messages = await get_messages(db, session_id, limit=100)
    return [ChatMessageRead.model_validate(m) for m in messages]


@router.delete("/sessions/{session_id}", status_code=200)
async def delete_chat_session(
    session_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    await delete_session(db, user.id, session_id)
    await db.commit()
    return {"message": "Chat session deleted."}
