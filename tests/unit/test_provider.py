"""Tests for the OpenAI-compatible provider used with Groq (HTTP mocked).

No real Groq requests are made — httpx.AsyncClient is replaced with a fake.
"""

import httpx
import pytest

from app.ai.providers.openai_compatible import OpenAICompatibleProvider
from app.core.config import settings
from app.core.exceptions import LLMUnavailableError

GROQ_BASE = "https://api.groq.com/openai/v1"
MODEL = "llama-3.3-70b-versatile"


class FakeResponse:
    def __init__(self, status_code=200, json_data=None, text="", lines=None):
        self.status_code = status_code
        self._json = json_data
        self.text = text
        self._lines = lines or []

    def json(self):
        return self._json

    async def aiter_lines(self):
        for line in self._lines:
            yield line

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False


async def _no_sleep(attempt: int) -> None:
    return None


def _ok_message(content: str) -> dict:
    return {"choices": [{"message": {"content": content, "tool_calls": None}}]}


def _patch_client(monkeypatch, response, *, exc=None):
    captured = []

    class FakeClient:
        def __init__(self, timeout=None):
            self.timeout = timeout

        async def __aenter__(self):
            return self

        async def __aexit__(self, *exc_):
            return False

        async def post(self, url, json=None, headers=None, timeout=None):
            captured.append({"url": url, "json": json, "headers": headers})
            if exc is not None:
                raise exc
            return response

        def stream(self, method, url, json=None, headers=None, timeout=None):
            captured.append({"url": url, "json": json, "headers": headers, "method": method})
            if exc is not None:
                raise exc
            return response

    monkeypatch.setattr("app.ai.providers.openai_compatible.httpx.AsyncClient", FakeClient)
    return captured


def _make_provider(monkeypatch, *, api_key="sk-test", max_retries=0):
    monkeypatch.setattr(settings, "LLM_API_KEY", api_key)
    monkeypatch.setattr(settings, "LLM_MODEL", MODEL)
    monkeypatch.setattr(settings, "LLM_BASE_URL", GROQ_BASE)
    monkeypatch.setattr(settings, "LLM_MAX_RETRIES", max_retries)
    provider = OpenAICompatibleProvider()
    monkeypatch.setattr(provider, "_sleep", _no_sleep)
    return provider


async def test_generate_hits_groq_endpoint_with_model(monkeypatch):
    captured = _patch_client(
        monkeypatch, FakeResponse(status_code=200, json_data=_ok_message("Namaste!"))
    )
    provider = _make_provider(monkeypatch)
    result = await provider.generate([{"role": "user", "content": "hi"}])
    assert result["content"] == "Namaste!"
    call = captured[0]
    assert call["url"] == f"{GROQ_BASE}/chat/completions"
    assert call["json"]["model"] == MODEL
    assert call["headers"]["Authorization"] == "Bearer sk-test"


async def test_generate_uses_configured_model_and_url(monkeypatch):
    monkeypatch.setattr(settings, "LLM_MODEL", "another-supported-groq-model")
    monkeypatch.setattr(settings, "LLM_BASE_URL", GROQ_BASE)
    monkeypatch.setattr(settings, "LLM_API_KEY", "sk-test")
    captured = _patch_client(
        monkeypatch, FakeResponse(status_code=200, json_data=_ok_message("ok"))
    )
    provider = OpenAICompatibleProvider()
    await provider.generate([{"role": "user", "content": "hi"}])
    assert captured[0]["url"] == f"{GROQ_BASE}/chat/completions"
    assert captured[0]["json"]["model"] == "another-supported-groq-model"


async def test_generate_without_key_sends_no_auth_header(monkeypatch):
    captured = _patch_client(
        monkeypatch, FakeResponse(status_code=200, json_data=_ok_message("ok"))
    )
    provider = _make_provider(monkeypatch, api_key=None)
    await provider.generate([{"role": "user", "content": "hi"}])
    assert "Authorization" not in captured[0]["headers"]


async def test_invalid_key_returns_safe_error(monkeypatch):
    _patch_client(monkeypatch, FakeResponse(status_code=401, text="invalid api key"))
    provider = _make_provider(monkeypatch, api_key="sk-bad-key")
    with pytest.raises(LLMUnavailableError) as exc_info:
        await provider.generate([{"role": "user", "content": "hi"}])
    assert "sk-bad-key" not in str(exc_info.value)
    assert "LLM API returned HTTP" in str(exc_info.value)


async def test_timeout_returns_safe_error(monkeypatch):
    provider = _make_provider(monkeypatch, max_retries=0)
    _patch_client(monkeypatch, None, exc=httpx.ReadTimeout("timed out"))
    with pytest.raises(LLMUnavailableError):
        await provider.generate([{"role": "user", "content": "hi"}])


async def test_malformed_response_returns_safe_error(monkeypatch):
    _patch_client(monkeypatch, FakeResponse(status_code=200, json_data={"unexpected": "shape"}))
    provider = _make_provider(monkeypatch)
    with pytest.raises(LLMUnavailableError):
        await provider.generate([{"role": "user", "content": "hi"}])


async def test_retries_on_server_error(monkeypatch):
    responses = [
        FakeResponse(status_code=502, text="bad gateway"),
        FakeResponse(status_code=200, json_data=_ok_message("recovered")),
    ]
    captured = []

    class FakeClient:
        def __init__(self, timeout=None):
            self.timeout = timeout

        async def __aenter__(self):
            return self

        async def __aexit__(self, *exc_):
            return False

        async def post(self, url, json=None, headers=None, timeout=None):
            captured.append(url)
            return responses[len(captured) - 1]

    monkeypatch.setattr("app.ai.providers.openai_compatible.httpx.AsyncClient", FakeClient)
    provider = _make_provider(monkeypatch, max_retries=2)
    result = await provider.generate([{"role": "user", "content": "hi"}])
    assert result["content"] == "recovered"
    assert len(captured) == 2


async def test_does_not_retry_auth_errors(monkeypatch):
    responses = [FakeResponse(status_code=401, text="unauthorized")] * 5
    captured = []

    class FakeClient:
        def __init__(self, timeout=None):
            self.timeout = timeout

        async def __aenter__(self):
            return self

        async def __aexit__(self, *exc_):
            return False

        async def post(self, url, json=None, headers=None, timeout=None):
            captured.append(url)
            return responses[len(captured) - 1]

    monkeypatch.setattr("app.ai.providers.openai_compatible.httpx.AsyncClient", FakeClient)
    provider = _make_provider(monkeypatch, max_retries=2)
    with pytest.raises(LLMUnavailableError):
        await provider.generate([{"role": "user", "content": "hi"}])
    assert len(captured) == 1


async def test_generate_stream_success(monkeypatch):
    lines = [
        'data: {"choices": [{"delta": {"content": "Hello"}}]}',
        'data: {"choices": [{"delta": {"content": " world"}}]}',
        "data: [DONE]",
    ]
    _patch_client(
        monkeypatch, FakeResponse(status_code=200, json_data={}, lines=lines)
    )
    provider = _make_provider(monkeypatch)
    chunks = [
        chunk
        async for chunk in provider.generate_stream([{"role": "user", "content": "hi"}])
    ]
    assert chunks == ["Hello", " world"]
