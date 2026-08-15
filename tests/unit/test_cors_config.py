"""CORS configuration parsing tests.

These construct a fresh Settings without the local `.env` file so the results
are deterministic regardless of the developer's machine.
"""

from app.core.config import Settings


def _settings(**overrides):
    return Settings(_env_file=None, **overrides)


def test_default_cors_origins_include_localhost_and_production():
    origins = _settings().CORS_ORIGINS
    assert "http://localhost:3000" in origins
    assert "https://fincompass-three.vercel.app" in origins


def test_default_cors_origin_regex_matches_vercel_preview():
    regex = _settings().CORS_ORIGIN_REGEX
    assert regex
    import re

    pattern = re.compile(regex)
    assert pattern.fullmatch(
        "https://fincompass-imw2hcdn4-adityaparidaomm-3447s-projects.vercel.app"
    )
    assert pattern.fullmatch(
        "https://fincompass-abc123-adityaparidaomm-3447s-projects.vercel.app"
    )
    assert not pattern.fullmatch("https://fincompass-three.vercel.app")
    assert not pattern.fullmatch("https://evil.example.com")


def test_cors_origins_comma_separated_with_whitespace():
    s = _settings(
        CORS_ORIGINS=" https://a.example.com , http://localhost:3000 ,https://b.example.com "
    )
    assert s.CORS_ORIGINS == [
        "https://a.example.com",
        "http://localhost:3000",
        "https://b.example.com",
    ]


def test_cors_origins_json_array_string():
    s = _settings(
        CORS_ORIGINS='["https://a.example.com", "http://localhost:3000"]'
    )
    assert s.CORS_ORIGINS == ["https://a.example.com", "http://localhost:3000"]


def test_cors_origins_blank_returns_empty_list():
    assert _settings(CORS_ORIGINS="").CORS_ORIGINS == []
    assert _settings(CORS_ORIGINS="   ").CORS_ORIGINS == []
    assert _settings(CORS_ORIGINS=None).CORS_ORIGINS == []
