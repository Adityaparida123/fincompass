"""FinAI agent orchestration."""

import json
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.memory import add_message, create_session, get_messages, get_session
from app.ai.prompts import build_messages
from app.ai.providers.openai_compatible import OpenAICompatibleProvider
from app.ai.router import route_intent
from app.ai.safety import (
    borrowing_caution_suffix,
    requires_borrowing_caution,
    sanitize_financial_claims,
    validate_response,
)
from app.ai.tools import TOOL_SPECS, ToolContext, execute_tool
from app.core.config import settings
from app.core.exceptions import ConsentDeniedError, LLMUnavailableError
from app.core.logging import get_logger
from app.db.models.consent import ConsentType
from app.knowledge.base import format_docs_for_context, get_knowledge_retriever
from app.schemas.chat import ChatResponse
from app.services.audit import log_audit
from app.services.consent.service import require_consent
from app.services.finance.context import build_context_for_intent

logger = get_logger(__name__)


def get_provider() -> OpenAICompatibleProvider:
    return OpenAICompatibleProvider()


async def _financial_context(
    db: AsyncSession,
    user_id: int,
    intent: str,
    message: str = "",
) -> str | None:
    """Build a minimal, consented financial context slice for LLM grounding.

    Only the fields needed for the detected intent are included (data
    minimization). Returns None when no personal context is needed.
    """
    slice_ = await build_context_for_intent(db, user_id, intent, message)
    return slice_.text or None


async def chat(
    db: AsyncSession,
    user_id: int,
    message: str,
    *,
    session_id: int | None = None,
    language: str | None = None,
) -> ChatResponse:
    routing = route_intent(message)
    intent = str(routing["intent"])
    needs_context = bool(routing["needs_context"])

    if not settings.llm_configured:
        return await _no_llm_fallback(db, user_id, message, routing, session_id)

    try:
        provider = get_provider()
    except Exception as exc:  # noqa: BLE001
        logger.error("LLM provider init failed: %s", exc)
        return await _no_llm_fallback(db, user_id, message, routing, session_id)

    if needs_context:
        await require_consent(db, user_id, ConsentType.financial_data_analysis)
        await require_consent(db, user_id, ConsentType.chat_financial_context)

    session = await _ensure_session(db, user_id, message, session_id, language)
    await add_message(db, session.id, "user", message, intent=intent)

    history = await get_messages(db, session.id)
    llm_history = [{"role": m.role, "content": m.content} for m in history if m.role in ("user", "assistant")]
    if llm_history and llm_history[-1]["role"] == "user":
        llm_history = llm_history[:-1]

    context_parts: list[str] = []
    if needs_context:
        slice_ = await build_context_for_intent(db, user_id, intent, message)
        if slice_.text:
            context_parts.append(slice_.text)

    if intent == "general" or not needs_context:
        docs = get_knowledge_retriever().search(message, top_k=2)
        knowledge = format_docs_for_context(docs)
        if knowledge:
            context_parts.append(f"Reference knowledge (cite sources when used):\n{knowledge}")

    context_text = "\n\n".join(context_parts) if context_parts else None
    tool_results: list[dict[str, str]] = []
    tool_used: str | None = None

    messages = build_messages(
        llm_history, financial_context=context_text, language=session.language
    )
    llm_messages = list(messages)

    try:
        first = await provider.generate(llm_messages, tools=TOOL_SPECS)
    except LLMUnavailableError:
        return await _no_llm_fallback(db, user_id, message, routing, session_id)

    tool_calls = first.get("tool_calls")
    ctx = ToolContext(db=db, user_id=user_id, session_id=session.id)

    if tool_calls:
        for call in tool_calls:
            fn = call["function"]
            name = fn.get("name", "")
            try:
                args = json.loads(fn.get("arguments") or "{}")
            except json.JSONDecodeError:
                args = {}
            tool_used = name
            try:
                result = await execute_tool(ctx, name, args)
                content = json.dumps(result, default=str, ensure_ascii=False)
            except ConsentDeniedError:
                content = json.dumps({"error": "consent_denied", "message": "Consent required."})
            except Exception as exc:  # noqa: BLE001
                logger.warning("Tool %s failed: %s", name, exc)
                content = json.dumps({"error": "tool_failed", "message": "This calculation could not be completed."})
            tool_results.append({"role": "tool", "content": content})

        llm_messages.append(first)
        for result in tool_results:
            llm_messages.append(result)

        try:
            second = await provider.generate(llm_messages, tools=None)
        except LLMUnavailableError:
            return await _no_llm_fallback(db, user_id, message, routing, session_id)
        reply = second.get("content") or ""
    else:
        reply = first.get("content") or ""

    reply = sanitize_financial_claims(reply)
    if requires_borrowing_caution(intent):
        reply = reply.rstrip() + borrowing_caution_suffix()

    is_safe, replacement = validate_response(reply)
    if not is_safe and replacement:
        reply = replacement

    await add_message(
        db,
        session.id,
        "assistant",
        reply,
        intent=intent,
        tool_used=tool_used,
    )
    await log_audit(
        db,
        action="chat.message",
        resource_type="chat_session",
        user_id=user_id,
        resource_id=session.id,
        metadata={"intent": intent, "tool_used": tool_used},
    )
    await db.commit()

    return ChatResponse(
        reply=reply,
        session_id=session.id,
        intent=intent,
        tool_used=tool_used,
        tool_result=json.loads(tool_results[0]["content"]) if tool_results else None,
        needs_financial_context=needs_context,
    )


async def _ensure_session(
    db: AsyncSession,
    user_id: int,
    message: str,
    session_id: int | None,
    language: str | None,
):
    if session_id is not None:
        session = await get_session(db, user_id, session_id)
        if language:
            session.language = language
        return session
    title = message[:60].strip() or "New conversation"
    lang = language or "en"
    return await create_session(db, user_id, title=title, language=lang)


async def _no_llm_fallback(
    db: AsyncSession,
    user_id: int,
    message: str,
    routing: dict[str, object],
    session_id: int | None,
) -> ChatResponse:
    """Deterministic fallback: run a relevant tool when consent allows."""
    from app.schemas.chat import ChatResponse as CR

    intent = str(routing["intent"])
    needs_context = bool(routing["needs_context"])
    session = await _ensure_session(db, user_id, message, session_id, None)
    await add_message(db, session.id, "user", message, intent=intent)

    tool_used: str | None = None
    tool_result: dict[str, Any] | None = None
    reply: str

    if needs_context:
        try:
            await require_consent(db, user_id, ConsentType.financial_data_analysis)
            ctx = ToolContext(db=db, user_id=user_id, session_id=session.id)
            if intent in ("savings", "personal_general"):
                tool_used = "calculate_savings_capacity"
                from app.services.readiness.factors import build_readiness_input

                data = await build_readiness_input(db, user_id)
                tool_result = await execute_tool(
                    ctx,
                    tool_used,
                    {
                        "income": str(data.income),
                        "expenses": str(data.total_expenses),
                        "debt_payments": str(data.debt_payments),
                    },
                )
                est = tool_result.get("estimated_monthly_savings", "0")
                reply = (
                    f"Based on your recorded data, estimated monthly savings capacity is "
                    f"₹{est} (estimate only). Configure LLM_API_KEY for conversational guidance."
                )
            elif intent == "loan":
                reply = (
                    "Loan affordability requires income, expenses, and loan terms. "
                    "Use POST /api/v1/tools/loan-simulation or configure an LLM for guided analysis."
                )
            else:
                reply = (
                    "FinAI local mode: personal analysis available via REST APIs. "
                    "Set LLM_API_KEY, LLM_MODEL, and LLM_BASE_URL for full chat."
                )
        except ConsentDeniedError:
            reply = "Personal financial analysis requires consent. Grant financial_data_analysis consent first."
    else:
        docs = get_knowledge_retriever().search(message, top_k=1)
        if docs:
            reply = (
                f"From our knowledge base ({docs[0].source}): "
                f"{docs[0].content[:400]}... "
                "Configure an LLM for full conversational answers."
            )
        else:
            reply = (
                "FinAI is running without a language model. "
                "Financial calculators are at /api/v1/tools/*. Set LLM credentials to enable chat."
            )

    await add_message(db, session.id, "assistant", reply, intent=intent, tool_used=tool_used)
    await db.commit()
    return CR(
        reply=reply,
        session_id=session.id,
        intent=intent,
        tool_used=tool_used,
        tool_result=tool_result,
    )
