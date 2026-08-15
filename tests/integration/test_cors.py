"""CORS preflight and origin-allowlist behavior tests."""

import pytest


@pytest.mark.parametrize(
    "origin",
    [
        "http://localhost:3000",
        "https://fincompass-three.vercel.app",
    ],
)
async def test_register_preflight_allows_configured_origins(client, origin):
    response = await client.options(
        "/api/v1/auth/register",
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == origin
    assert response.headers["access-control-allow-credentials"] == "true"
    assert "POST" in response.headers["access-control-allow-methods"]
    assert "content-type" in response.headers["access-control-allow-headers"]


async def test_register_preflight_rejects_unknown_origin(client):
    response = await client.options(
        "/api/v1/auth/register",
        headers={
            "Origin": "https://evil.example.com",
            "Access-Control-Request-Method": "POST",
        },
    )
    assert response.status_code == 400
    assert "access-control-allow-origin" not in response.headers
