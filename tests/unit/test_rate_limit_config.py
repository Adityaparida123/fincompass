"""Rate-limit configuration tests.

These construct a fresh Settings without the local `.env` file so the results
are deterministic regardless of the developer's machine.
"""

from app.core.config import Settings


def _settings(**overrides):
    return Settings(_env_file=None, **overrides)


def test_chat_and_ml_limits_defaults():
    s = _settings(RATE_LIMIT_ENABLED="false")
    assert s.RATE_LIMIT_CHAT_LIMIT == 30
    assert s.RATE_LIMIT_CHAT_WINDOW == 60
    assert s.RATE_LIMIT_ML_LIMIT == 60
    assert s.RATE_LIMIT_ML_WINDOW == 60


def test_register_limits_sensible():
    s = _settings()
    assert 0 < s.RATE_LIMIT_REGISTER_LIMIT <= 10
    assert s.RATE_LIMIT_REGISTER_WINDOW >= 300
    assert 0 < s.RATE_LIMIT_REGISTER_EMAIL_LIMIT <= s.RATE_LIMIT_REGISTER_LIMIT
    assert s.RATE_LIMIT_REGISTER_EMAIL_WINDOW >= 300


def test_login_limits_sensible():
    s = _settings()
    assert 0 < s.RATE_LIMIT_LOGIN_LIMIT <= 10
    assert s.RATE_LIMIT_LOGIN_WINDOW == 60
    assert 0 < s.RATE_LIMIT_LOGIN_EMAIL_LIMIT <= s.RATE_LIMIT_LOGIN_LIMIT


def test_password_reset_limits_strict():
    s = _settings()
    assert 0 < s.RATE_LIMIT_FORGOT_LIMIT <= 5
    assert s.RATE_LIMIT_FORGOT_WINDOW >= 3600
    assert 0 < s.RATE_LIMIT_FORGOT_EMAIL_LIMIT <= s.RATE_LIMIT_FORGOT_LIMIT
    assert s.RATE_LIMIT_FORGOT_EMAIL_WINDOW >= 3600
    assert 0 < s.RATE_LIMIT_RESET_LIMIT <= 5
    assert s.RATE_LIMIT_RESET_WINDOW >= 3600


def test_refresh_limit_generous():
    s = _settings()
    assert s.RATE_LIMIT_REFRESH_LIMIT >= 20


def test_rate_limiting_can_be_disabled():
    assert _settings(RATE_LIMIT_ENABLED="false").RATE_LIMIT_ENABLED is False
