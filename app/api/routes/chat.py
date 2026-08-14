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
from app.core.config import settings
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
    intent = str(routing["intent"])
    needs_context = bool(routing["needs_context"])
    if needs_context:
        await require_consent(db, user.id, ConsentType.financial_data_analysis)
        await require_consent(db, user.id, ConsentType.chat_financial_context)

    session = None
    if data.session_id:
        session = await get_session(db, user.id, data.session_id)
    else:
        session = await create_session(db, user.id, title=data.message[:60])
    if data.language:
        session.language = data.language
    await add_message(db, session.id, "user", data.message, intent=intent)

    if not settings.llm_configured:
        async def no_llm_generator():
            reply = await _stream_fallback_reply(db, user.id, data.message, intent, session.id)
            await add_message(db, session.id, "assistant", reply, intent=intent)
            await db.commit()
            yield f"data: {json.dumps({'delta': reply}, ensure_ascii=False)}\n\n"
            yield "data: [DONE]\n\n"

        return StreamingResponse(no_llm_generator(), media_type="text/event-stream")

    history = await get_messages(db, session.id)
    llm_history = to_llm_history(history)
    if llm_history and llm_history[-1]["role"] == "user":
        llm_history = llm_history[:-1]

    context_text = None
    if needs_context:
        from app.ai.agent import _financial_context

        context_text = await _financial_context(db, user.id, intent=intent, message=data.message)

    messages = build_messages(llm_history, financial_context=context_text, language=session.language)
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
            await add_message(db, session.id, "assistant", full, intent=intent)
            await db.commit()
            yield "data: [DONE]\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


async def _stream_fallback_reply(
    db: AsyncSession,
    user_id: int,
    message: str,
    intent: str,
    session_id: int,
) -> str:
    """Deterministic no-LLM stream reply (same behaviour as the non-stream fallback)."""
    from app.knowledge.base import get_knowledge_retriever
    from app.services.consent.service import require_consent

    reply: str
    if intent in ("savings", "personal_general"):
        try:
            await require_consent(db, user_id, ConsentType.financial_data_analysis)
            from app.ai.tools import ToolContext, execute_tool
            from app.services.readiness.factors import build_readiness_input

            ctx = ToolContext(db=db, user_id=user_id, session_id=session_id)
            data = await build_readiness_input(db, user_id)
            result = await execute_tool(
                ctx,
                "calculate_savings_capacity",
                {
                    "income": str(data.income),
                    "expenses": str(data.total_expenses),
                    "debt_payments": str(data.debt_payments),
                },
            )
            est = result.get("estimated_monthly_savings", "0")
            reply = (
                f"Based on your recorded data, estimated monthly savings capacity is "
                f"₹{est} (estimate only). Configure LLM_API_KEY, LLM_MODEL, and LLM_BASE_URL "
                "for conversational guidance."
            )
        except Exception:  # noqa: BLE001
            reply = (
                "FinAI local mode: personal analysis available via REST APIs. "
                "Set LLM_API_KEY, LLM_MODEL, and LLM_BASE_URL for full chat."
            )
        return reply

    docs = get_knowledge_retriever().search(message, top_k=1)
    if docs:
        return (
            f"From our knowledge base ({docs[0].source}): "
            f"{docs[0].content[:400]}... "
            "Configure an LLM for full conversational answers."
        )
    return (
        "FinAI is running without a language model. "
        "Financial calculators are at /api/v1/tools/*. Set LLM credentials to enable chat."
    )


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
