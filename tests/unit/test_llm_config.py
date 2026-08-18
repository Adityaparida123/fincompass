"""LLM configuration tests — Groq defaults and environment-driven overrides.

These tests construct a fresh Settings without the local `.env` file so the
results are deterministic regardless of the developer's machine.
"""

from app.core.config import Settings


def _settings(**overrides):
    return Settings(_env_file=None, **overrides)


def test_default_llm_model_is_groq():
    assert _settings().LLM_MODEL == "openai/gpt-oss-120b"


def test_default_llm_base_url_is_groq():
    assert _settings().LLM_BASE_URL == "https://api.groq.com/openai/v1"


def test_llm_api_key_defaults_to_none():
    assert _settings().LLM_API_KEY is None


def test_llm_not_configured_without_key():
    assert _settings().llm_configured is False


def test_llm_configured_with_key_and_model():
    s = _settings(LLM_API_KEY="sk-test", LLM_MODEL="openai/gpt-oss-120b")
    assert s.llm_configured is True


def test_llm_env_overrides(monkeypatch):
    monkeypatch.setenv("LLM_API_KEY", "sk-test-key")
    monkeypatch.setenv("LLM_MODEL", "another-supported-groq-model")
    monkeypatch.setenv("LLM_BASE_URL", "https://api.groq.com/openai/v1")
    s = _settings()
    assert s.LLM_MODEL == "another-supported-groq-model"
    assert s.LLM_BASE_URL == "https://api.groq.com/openai/v1"
    assert s.LLM_API_KEY == "sk-test-key"
    assert s.llm_configured is True


def test_llm_blank_env_falls_back_to_defaults(monkeypatch):
    monkeypatch.setenv("LLM_MODEL", "")
    monkeypatch.setenv("LLM_BASE_URL", "")
    monkeypatch.setenv("LLM_API_KEY", "")
    s = _settings()
    assert s.LLM_MODEL == "openai/gpt-oss-120b"
    assert s.LLM_BASE_URL == "https://api.groq.com/openai/v1"
    assert s.LLM_API_KEY is None
    assert s.llm_configured is False


def test_llm_timeout_and_retry_defaults():
    s = _settings()
    assert s.LLM_TIMEOUT_SECONDS == 60.0
    assert s.LLM_READ_TIMEOUT_SECONDS == 90.0
    assert s.LLM_MAX_RETRIES == 2
