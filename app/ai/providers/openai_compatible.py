"""OpenAI-compatible provider.

Talks to any endpoint implementing the OpenAI chat completions API
(base URL from `LLM_BASE_URL`, model from `LLM_MODEL`, key from `LLM_API_KEY`).
"""

from collections.abc import AsyncIterator
from typing import Any

import httpx

from app.ai.providers.base import LLMProvider
from app.core.config import settings
from app.core.exceptions import LLMUnavailableError
from app.core.logging import get_logger

logger = get_logger(__name__)


class OpenAICompatibleProvider(LLMProvider):
    def __init__(self) -> None:
        base_url = (settings.LLM_BASE_URL or "https://api.openai.com/v1").rstrip("/")
        self._chat_url = f"{base_url}/chat/completions"
        self._model = settings.LLM_MODEL
        self._api_key = settings.LLM_API_KEY
        self._timeout = httpx.Timeout(60.0, read=90.0)

    async def _request(self, payload: dict[str, Any], *, stream: bool = False) -> httpx.Response:
        headers = {"Content-Type": "application/json"}
        if self._api_key:
            headers["Authorization"] = f"Bearer {self._api_key}"
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                response = await client.post(
                    self._chat_url, json=payload, headers=headers, timeout=self._timeout
                )
        except httpx.HTTPError as exc:
            logger.error("LLM request failed: %s", exc)
            raise LLMUnavailableError("The AI assistant is temporarily unavailable.") from exc

        if response.status_code >= 400:
            logger.error("LLM error %s: %s", response.status_code, response.text[:500])
            raise LLMUnavailableError("The AI assistant is temporarily unavailable.")
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
        response = await self._request(payload)
        data = response.json()
        choice = data["choices"][0]["message"]
        tool_calls = choice.get("tool_calls") or None
        return {
            "content": choice.get("content") or "",
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
        response = await self._request(payload, stream=True)
        async with response:
            async for line in response.aiter_lines():
                if not line.startswith("data:"):
                    continue
                data = line[5:].strip()
                if data == "[DONE]":
                    break
                import json

                try:
                    chunk = json.loads(data)
                    delta = chunk["choices"][0]["delta"].get("content") or ""
                except (json.JSONDecodeError, KeyError, IndexError):
                    continue
                if delta:
                    yield delta
