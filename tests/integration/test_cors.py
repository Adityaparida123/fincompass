"""CORS preflight and origin-allowlist behavior tests."""

import pytest


@pytest.mark.parametrize(
    "origin",
    [
        "http://localhost:3000",
        "https://fincompass-three.vercel.app",
        "https://fincompass-imw2hcdn4-adityaparidaomm-3447s-projects.vercel.app",
        "https://fincompass-abcdef123-adityaparidaomm-3447s-projects.vercel.app",
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


async def test_register_preflight_authorization_header_allowed(client):
    response = await client.options(
        "/api/v1/auth/register",
        headers={
            "Origin": "https://fincompass-three.vercel.app",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type,authorization",
        },
    )
    assert response.status_code == 200
    assert "authorization" in response.headers["access-control-allow-headers"].lower()


async def test_register_preflight_rejects_unrelated_preview_domain(client):
    response = await client.options(
        "/api/v1/auth/register",
        headers={
            "Origin": "https://other-project-xyz-otheruser-0000-projects.vercel.app",
            "Access-Control-Request-Method": "POST",
        },
    )
    assert response.status_code == 400
    assert "access-control-allow-origin" not in response.headers


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
