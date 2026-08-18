"""OpenAI-compatible LLM provider (used for Groq).

Talks to any endpoint implementing the OpenAI chat completions API:

- base_url <- settings.LLM_BASE_URL  (default: https://api.groq.com/openai/v1)
- model    <- settings.LLM_MODEL      (default: openai/gpt-oss-120b)
- api_key  <- settings.LLM_API_KEY    (never hardcoded, never logged)

Timeout and retry behaviour is configuration-driven too.
"""

import asyncio
import json
import random
from collections.abc import AsyncIterator
from typing import Any

import httpx

from app.ai.providers.base import LLMProvider
from app.core.config import settings
from app.core.exceptions import LLMUnavailableError
from app.core.logging import get_logger

logger = get_logger(__name__)

_RETRIABLE_STATUS = {429, 500, 502, 503, 504}


class OpenAICompatibleProvider(LLMProvider):
    def __init__(self) -> None:
        base_url = (settings.LLM_BASE_URL or "https://api.groq.com/openai/v1").rstrip("/")
        self._chat_url = f"{base_url}/chat/completions"
        self._model = settings.LLM_MODEL
        self._api_key = settings.LLM_API_KEY
        self._timeout = httpx.Timeout(
            settings.LLM_TIMEOUT_SECONDS, read=settings.LLM_READ_TIMEOUT_SECONDS
        )
        self._max_retries = settings.LLM_MAX_RETRIES

    async def _sleep(self, attempt: int) -> None:
        delay = min(2 ** attempt, 8) * random.uniform(0.5, 1.0)
        await asyncio.sleep(delay)

    async def _request(self, payload: dict[str, Any]) -> httpx.Response:
        headers = {"Content-Type": "application/json"}
        if self._api_key:
            headers["Authorization"] = f"Bearer {self._api_key}"
        attempt = 0
        while True:
            try:
                async with httpx.AsyncClient(timeout=self._timeout) as client:
                    response = await client.post(
                        self._chat_url, json=payload, headers=headers, timeout=self._timeout
                    )
            except httpx.HTTPError as exc:
                # Network/timeout failure — retry transiently, then fail safe.
                if attempt < self._max_retries:
                    attempt += 1
                    await self._sleep(attempt)
                    continue
                logger.error(
                    "LLM request failed after %d attempt(s): model=%s url=%s error=%s",
                    attempt + 1, self._model, self._chat_url, exc,
                    exc_info=True,
                )
                raise LLMUnavailableError(
                    f"LLM request failed after {attempt + 1} attempt(s): {exc}"
                ) from exc

            if response.status_code in _RETRIABLE_STATUS and attempt < self._max_retries:
                attempt += 1
                await self._sleep(attempt)
                continue

            if response.status_code >= 400:
                # Invalid key / model / rate limit (exhausted) — never expose internals.
                body_preview = response.text[:500] if hasattr(response, 'text') else '<no body>'
                logger.error(
                    "LLM HTTP error %s: model=%s url=%s body=%s",
                    response.status_code, self._model, self._chat_url, body_preview,
                )
                raise LLMUnavailableError(
                    f"LLM API returned HTTP {response.status_code}"
                )
            return response

    async def generate(
        self,
        messages: list[dict[str, str]],
        *,
        tools: list[dict[str, Any]] | None = None,
        temperature: float = 0.3,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "model": self._model,
            "messages": messages,
            "temperature": temperature,
            "stream": False,
        }
        if tools:
            payload["tools"] = tools
        logger.info(
            "LLM generate model=%s stream=False tool_count=%d msg_count=%d",
            self._model, len(tools) if tools else 0, len(messages),
        )
        response = await self._request(payload)
        try:
            data = response.json()
            choice = data["choices"][0]["message"]
        except (ValueError, KeyError, IndexError, TypeError) as exc:
            logger.error("Malformed LLM response: %s", str(exc)[:300])
            raise LLMUnavailableError("The AI assistant is temporarily unavailable.") from exc
        tool_calls = choice.get("tool_calls") or None
        content = choice.get("content") or ""
        logger.info(
            "LLM generate result content_len=%d tool_calls=%s finish_reason=%s",
            len(content), bool(tool_calls),
            data.get("choices", [{}])[0].get("finish_reason", "unknown"),
        )
        return {
            "content": content,
            "tool_calls": tool_calls,
            "raw": data,
        }

    async def generate_stream(
        self,
        messages: list[dict[str, str]],
        *,
        temperature: float = 0.3,
    ) -> AsyncIterator[str]:
        payload: dict[str, Any] = {
            "model": self._model,
            "messages": messages,
            "temperature": temperature,
            "stream": True,
        }
        headers = {"Content-Type": "application/json"}
        if self._api_key:
            headers["Authorization"] = f"Bearer {self._api_key}"
        attempt = 0
        logger.info("LLM stream model=%s msg_count=%d", self._model, len(messages))
        while True:
            try:
                async with httpx.AsyncClient(timeout=self._timeout) as client:
                    async with client.stream(
                        "POST", self._chat_url, json=payload, headers=headers, timeout=self._timeout
                    ) as response:
                        if response.status_code in _RETRIABLE_STATUS and attempt < self._max_retries:
                            attempt += 1
                            await self._sleep(attempt)
                            continue
                        if response.status_code >= 400:
                            logger.error(
                                "LLM stream error %s: model=%s url=%s body=%s",
                                response.status_code, self._model, self._chat_url,
                                response.text[:500],
                            )
                            raise LLMUnavailableError(
                                f"LLM stream API returned HTTP {response.status_code}"
                            )
                        chunk_count = 0
                        total_len = 0
                        async for line in response.aiter_lines():
                            if not line.startswith("data:"):
                                continue
                            data = line[5:].strip()
                            if data == "[DONE]":
                                break
                            try:
                                chunk = json.loads(data)
                                delta = chunk["choices"][0]["delta"].get("content") or ""
                            except (json.JSONDecodeError, KeyError, IndexError):
                                continue
                            if delta:
                                chunk_count += 1
                                total_len += len(delta)
                                yield delta
                        logger.info("LLM stream done chunks=%d total_len=%d", chunk_count, total_len)
                        return
            except httpx.HTTPError as exc:
                if attempt < self._max_retries:
                    attempt += 1
                    await self._sleep(attempt)
                    continue
                logger.error(
                    "LLM stream failed after %d attempt(s): model=%s url=%s error=%s",
                    attempt + 1, self._model, self._chat_url, exc,
                    exc_info=True,
                )
                raise LLMUnavailableError(
                    f"LLM stream failed after {attempt + 1} attempt(s): {exc}"
                ) from exc
