"""LLM provider interface.

The backend depends only on this abstraction. Providers are selected by
configuration; never hardcode a specific vendor in business logic.
"""

from abc import ABC, abstractmethod
from collections.abc import AsyncIterator
from typing import Any


class LLMMessage:
    """A chat message sent to the model."""

    def __init__(self, role: str, content: str) -> None:
        self.role = role
        self.content = content


class LLMProvider(ABC):
    @abstractmethod
    async def generate(
        self,
        messages: list[dict[str, str]],
        *,
        tools: list[dict[str, Any]] | None = None,
        temperature: float = 0.3,
    ) -> dict[str, Any]:
        """Generate a response. Returns a dict with keys:
        content (str), tool_calls (list | None), raw (dict | None).
        """
        raise NotImplementedError

    @abstractmethod
    def generate_stream(
        self,
        messages: list[dict[str, str]],
        *,
        temperature: float = 0.3,
    ) -> AsyncIterator[str]:
        """Stream the assistant text response chunk by chunk."""
        raise NotImplementedError
