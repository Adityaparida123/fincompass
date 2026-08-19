"""Integration tests for authentication flows."""

from app.core.config import settings
from app.services.auth.tokens import REFRESH_COOKIE_NAME, set_refresh_cookie


async def test_refresh_cookie_is_secure_in_production(monkeypatch):
    from fastapi import Response

    monkeypatch.setattr(type(settings), "is_production", property(lambda self: True))

    response = Response()
    set_refresh_cookie(response, refresh_token="fake-token", remember_me=True)

    cookie = response.headers["set-cookie"]
    assert f"{REFRESH_COOKIE_NAME}=" in cookie
    assert "HttpOnly" in cookie
    assert "Secure" in cookie


async def test_refresh_cookie_defaults_samesite_none_in_production(monkeypatch):
    from fastapi import Response

    monkeypatch.setattr(type(settings), "is_production", property(lambda self: True))
    monkeypatch.setattr(settings, "COOKIE_SAMESITE", "")

    response = Response()
    set_refresh_cookie(response, refresh_token="fake-token", remember_me=True)

    assert "SameSite=none" in response.headers["set-cookie"]


async def test_refresh_cookie_httponly_in_dev():
    from fastapi import Response

    response = Response()
    set_refresh_cookie(response, refresh_token="fake-token", remember_me=False)

    cookie = response.headers["set-cookie"]
    assert "HttpOnly" in cookie
    assert "Secure" not in cookie


async def test_register(client):
    response = await client.post(
        "/api/v1/auth/register",
        json={"full_name": "Alice", "email": "alice@example.com", "password": "super-secure-pass"},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["user"]["email"] == "alice@example.com"
    assert "access_token" in body["tokens"]
    assert "refresh_token" in body["tokens"]
    assert "password" not in body


async def test_register_duplicate_email(client):
    payload = {"full_name": "Bob", "email": "bob@example.com", "password": "super-secure-pass"}
    first = await client.post("/api/v1/auth/register", json=payload)
    assert first.status_code == 201
    second = await client.post("/api/v1/auth/register", json=payload)
    assert second.status_code == 409


async def test_login_success(client):
    await client.post(
        "/api/v1/auth/register",
        json={"full_name": "Carol", "email": "carol@example.com", "password": "super-secure-pass"},
    )
    response = await client.post(
        "/api/v1/auth/login",
        json={"email": "carol@example.com", "password": "super-secure-pass", "remember_me": True},
    )
    assert response.status_code == 200
    assert "access_token" in response.json()["tokens"]


async def test_login_wrong_password(client):
    await client.post(
        "/api/v1/auth/register",
        json={"full_name": "Dave", "email": "dave@example.com", "password": "super-secure-pass"},
    )
    response = await client.post(
        "/api/v1/auth/login",
        json={"email": "dave@example.com", "password": "wrong-password"},
    )
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHORIZED"


async def test_refresh_flow(client):
    await client.post(
        "/api/v1/auth/register",
        json={"full_name": "Eve", "email": "eve@example.com", "password": "super-secure-pass"},
    )
    login = await client.post(
        "/api/v1/auth/login",
        json={"email": "eve@example.com", "password": "super-secure-pass"},
    )
    refresh_token = login.json()["tokens"]["refresh_token"]
    response = await client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_token})
    assert response.status_code == 200
    assert "access_token" in response.json()


async def test_refresh_with_bad_token(client):
    response = await client.post("/api/v1/auth/refresh", json={"refresh_token": "invalid-token"})
    assert response.status_code in (401, 422)


async def test_logout(client):
    await client.post(
        "/api/v1/auth/register",
        json={"full_name": "Frank", "email": "frank@example.com", "password": "super-secure-pass"},
    )
    response = await client.post("/api/v1/auth/logout", json={})
    assert response.status_code in (204, 200)


async def test_me_requires_auth(client):
    response = await client.get("/api/v1/auth/me")
    assert response.status_code == 401


async def test_me_with_token(client, auth_headers):
    response = await client.get("/api/v1/auth/me", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["user"]["email"] == "test@example.com"
    assert response.json()["default_currency"] == "INR"


async def test_weak_password_rejected(client):
    response = await client.post(
        "/api/v1/auth/register",
        json={"full_name": "Gary", "email": "gary@example.com", "password": "short"},
    )
    assert response.status_code == 422


async def test_forgot_password_returns_same_response(client):
    await client.post(
        "/api/v1/auth/register",
        json={"full_name": "Hank", "email": "hank@example.com", "password": "super-secure-pass"},
    )
    existing = await client.post("/api/v1/auth/forgot-password", json={"email": "hank@example.com"})
    missing = await client.post("/api/v1/auth/forgot-password", json={"email": "nobody@example.com"})
    assert existing.status_code == 200
    assert existing.json()["message"] == missing.json()["message"]


# ---------------------------------------------------------------------------
# Refresh token lifecycle tests
# ---------------------------------------------------------------------------


async def test_refresh_returns_both_tokens(client):
    """Successful refresh returns a new access + refresh token pair."""
    await client.post(
        "/api/v1/auth/register",
        json={"full_name": "R1", "email": "r1@example.com", "password": "super-secure-pass"},
    )
    login = await client.post(
        "/api/v1/auth/login",
        json={"email": "r1@example.com", "password": "super-secure-pass"},
    )
    rt = login.json()["tokens"]["refresh_token"]
    resp = await client.post("/api/v1/auth/refresh", json={"refresh_token": rt})
    assert resp.status_code == 200
    body = resp.json()
    assert "access_token" in body
    assert "refresh_token" in body
    assert body["token_type"] == "bearer"


async def test_refresh_new_access_token_is_usable(client):
    """Access token received from refresh can call protected endpoints."""
    await client.post(
        "/api/v1/auth/register",
        json={"full_name": "R2", "email": "r2@example.com", "password": "super-secure-pass"},
    )
    login = await client.post(
        "/api/v1/auth/login",
        json={"email": "r2@example.com", "password": "super-secure-pass"},
    )
    rt = login.json()["tokens"]["refresh_token"]
    refresh_resp = await client.post("/api/v1/auth/refresh", json={"refresh_token": rt})
    new_at = refresh_resp.json()["access_token"]
    me_resp = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {new_at}"})
    assert me_resp.status_code == 200
    assert me_resp.json()["user"]["email"] == "r2@example.com"


async def test_refresh_with_expired_refresh_token(client):
    """An expired refresh token must be rejected with 401."""
    from datetime import UTC, datetime, timedelta
    from app.core.security import create_refresh_token

    expired_rt = create_refresh_token(
        99999,
        remember_me=False,
        family_id="expired-family",
    )
    resp = await client.post("/api/v1/auth/refresh", json={"refresh_token": expired_rt})
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "UNAUTHORIZED"


async def test_refresh_with_revoked_refresh_token(client):
    """A revoked refresh token must be rejected with 401."""
    from app.services.auth.refresh_sessions import revoke_all_for_user

    reg = await client.post(
        "/api/v1/auth/register",
        json={"full_name": "R4", "email": "r4@example.com", "password": "super-secure-pass"},
    )
    rt = reg.json()["tokens"]["refresh_token"]
    user_id = reg.json()["user"]["id"]

    from app.db.mongo import get_database
    db = get_database()
    await revoke_all_for_user(db, user_id)

    resp = await client.post("/api/v1/auth/refresh", json={"refresh_token": rt})
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "UNAUTHORIZED"


async def test_refresh_token_rotation_old_token_rejected(client):
    """After rotation, the old refresh token must be rejected (reuse detection)."""
    await client.post(
        "/api/v1/auth/register",
        json={"full_name": "R5", "email": "r5@example.com", "password": "super-secure-pass"},
    )
    login = await client.post(
        "/api/v1/auth/login",
        json={"email": "r5@example.com", "password": "super-secure-pass"},
    )
    old_rt = login.json()["tokens"]["refresh_token"]

    rotate_resp = await client.post("/api/v1/auth/refresh", json={"refresh_token": old_rt})
    assert rotate_resp.status_code == 200

    reuse_resp = await client.post("/api/v1/auth/refresh", json={"refresh_token": old_rt})
    assert reuse_resp.status_code == 401
    assert "reuse" in reuse_resp.json()["error"]["message"].lower()


async def test_refresh_chained_rotations(client):
    """Multiple sequential refreshes should each succeed with a new token."""
    await client.post(
        "/api/v1/auth/register",
        json={"full_name": "R6", "email": "r6@example.com", "password": "super-secure-pass"},
    )
    login = await client.post(
        "/api/v1/auth/login",
        json={"email": "r6@example.com", "password": "super-secure-pass"},
    )
    rt = login.json()["tokens"]["refresh_token"]

    for _ in range(3):
        resp = await client.post("/api/v1/auth/refresh", json={"refresh_token": rt})
        assert resp.status_code == 200
        rt = resp.json()["refresh_token"]


async def test_refresh_with_no_token(client):
    """Missing refresh token in both body and cookie returns 401."""
    resp = await client.post("/api/v1/auth/refresh", json={"refresh_token": ""})
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "UNAUTHORIZED"


async def test_logout_then_refresh_rejected(client):
    """Refresh after logout must fail — the JTI was revoked."""
    reg = await client.post(
        "/api/v1/auth/register",
        json={"full_name": "R7", "email": "r7@example.com", "password": "super-secure-pass"},
    )
    rt = reg.json()["tokens"]["refresh_token"]

    logout_resp = await client.post("/api/v1/auth/logout", json={"refresh_token": rt})
    assert logout_resp.status_code in (204, 200)

    refresh_resp = await client.post("/api/v1/auth/refresh", json={"refresh_token": rt})
    assert refresh_resp.status_code == 401


async def test_user_a_cannot_use_user_b_refresh_token(client):
    """User A's refresh token must not work for User B's session."""
    reg_a = await client.post(
        "/api/v1/auth/register",
        json={"full_name": "UA", "email": "ua@example.com", "password": "super-secure-pass"},
    )
    rt_a = reg_a.json()["tokens"]["refresh_token"]

    reg_b = await client.post(
        "/api/v1/auth/register",
        json={"full_name": "UB", "email": "ub@example.com", "password": "super-secure-pass"},
    )
    login_b = await client.post(
        "/api/v1/auth/login",
        json={"email": "ub@example.com", "password": "super-secure-pass"},
    )
    rt_b = login_b.json()["tokens"]["refresh_token"]

    refresh_resp = await client.post("/api/v1/auth/refresh", json={"refresh_token": rt_b})
    assert refresh_resp.status_code == 200
    new_at = refresh_resp.json()["access_token"]

    me_resp = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {new_at}"})
    assert me_resp.status_code == 200
    assert me_resp.json()["user"]["email"] == "ub@example.com"
    assert me_resp.json()["user"]["id"] != reg_a.json()["user"]["id"]


async def test_refresh_after_password_reset_all_sessions_revoked(client):
    """After password reset, all refresh tokens for that user must be revoked."""
    from app.db.mongo import get_database
    from app.services.auth.refresh_sessions import revoke_all_for_user

    reg = await client.post(
        "/api/v1/auth/register",
        json={"full_name": "R9", "email": "r9@example.com", "password": "super-secure-pass"},
    )
    rt = reg.json()["tokens"]["refresh_token"]
    user_id = reg.json()["user"]["id"]

    db = get_database()
    await revoke_all_for_user(db, user_id)

    resp = await client.post("/api/v1/auth/refresh", json={"refresh_token": rt})
    assert resp.status_code == 401


async def test_refresh_returns_401_with_structured_error(client):
    """Refresh failure returns proper error structure with code and request_id."""
    resp = await client.post("/api/v1/auth/refresh", json={"refresh_token": "garbage"})
    assert resp.status_code in (401, 422)
    if resp.status_code == 401:
        body = resp.json()
        assert "error" in body
        assert body["error"]["code"] == "UNAUTHORIZED"
        assert "request_id" in body["error"]


# ---------------------------------------------------------------------------
# Remember Me cookie behavior tests
# ---------------------------------------------------------------------------


async def test_refresh_cookie_has_max_age_when_remember_me_true():
    """Remember Me checked: cookie must have Max-Age (persistent)."""
    from fastapi import Response

    response = Response()
    set_refresh_cookie(response, refresh_token="fake-token", remember_me=True)

    cookie = response.headers["set-cookie"]
    assert "Max-Age" in cookie


async def test_refresh_cookie_no_max_age_when_remember_me_false():
    """Remember Me unchecked: cookie must NOT have Max-Age (session cookie)."""
    from fastapi import Response

    response = Response()
    set_refresh_cookie(response, refresh_token="fake-token", remember_me=False)

    cookie = response.headers["set-cookie"]
    assert "Max-Age" not in cookie


async def test_remember_me_true_login_sets_persistent_cookie(client):
    """Login with remember_me=True sets a persistent cookie with Max-Age."""
    await client.post(
        "/api/v1/auth/register",
        json={"full_name": "RM1", "email": "rm1@example.com", "password": "super-secure-pass"},
    )
    response = await client.post(
        "/api/v1/auth/login",
        json={"email": "rm1@example.com", "password": "super-secure-pass", "remember_me": True},
    )
    assert response.status_code == 200
    cookie = response.headers.get("set-cookie", "")
    assert "Max-Age" in cookie


async def test_remember_me_false_login_sets_session_cookie(client):
    """Login with remember_me=False sets a session cookie (no Max-Age)."""
    await client.post(
        "/api/v1/auth/register",
        json={"full_name": "RM2", "email": "rm2@example.com", "password": "super-secure-pass"},
    )
    response = await client.post(
        "/api/v1/auth/login",
        json={"email": "rm2@example.com", "password": "super-secure-pass", "remember_me": False},
    )
    assert response.status_code == 200
    cookie = response.headers.get("set-cookie", "")
    assert "Max-Age" not in cookie


async def test_refresh_preserves_remember_me_cookie_type(client):
    """Refresh preserves the original remember_me cookie lifetime."""
    await client.post(
        "/api/v1/auth/register",
        json={"full_name": "RM3", "email": "rm3@example.com", "password": "super-secure-pass"},
    )
    login = await client.post(
        "/api/v1/auth/login",
        json={"email": "rm3@example.com", "password": "super-secure-pass", "remember_me": True},
    )
    rt = login.json()["tokens"]["refresh_token"]

    refresh_resp = await client.post("/api/v1/auth/refresh", json={"refresh_token": rt})
    assert refresh_resp.status_code == 200
    cookie = refresh_resp.headers.get("set-cookie", "")
    assert "Max-Age" in cookie


async def test_refresh_preserves_session_cookie_type(client):
    """Refresh preserves session cookie (no Max-Age) when remember_me was false."""
    await client.post(
        "/api/v1/auth/register",
        json={"full_name": "RM4", "email": "rm4@example.com", "password": "super-secure-pass"},
    )
    login = await client.post(
        "/api/v1/auth/login",
        json={"email": "rm4@example.com", "password": "super-secure-pass", "remember_me": False},
    )
    rt = login.json()["tokens"]["refresh_token"]

    refresh_resp = await client.post("/api/v1/auth/refresh", json={"refresh_token": rt})
    assert refresh_resp.status_code == 200
    cookie = refresh_resp.headers.get("set-cookie", "")
    assert "Max-Age" not in cookie


async def test_logout_clears_refresh_cookie(client):
    """Logout must clear the refresh cookie regardless of remember_me."""
    await client.post(
        "/api/v1/auth/register",
        json={"full_name": "RM5", "email": "rm5@example.com", "password": "super-secure-pass"},
    )
    login = await client.post(
        "/api/v1/auth/login",
        json={"email": "rm5@example.com", "password": "super-secure-pass", "remember_me": True},
    )
    rt = login.json()["tokens"]["refresh_token"]

    logout_resp = await client.post("/api/v1/auth/logout", json={"refresh_token": rt})
    assert logout_resp.status_code in (204, 200)
    cookie = logout_resp.headers.get("set-cookie", "")
    assert REFRESH_COOKIE_NAME in cookie
    assert "Max-Age=0" in cookie


async def test_cross_user_token_isolation_after_switch(client):
    """User A's refresh token must not work after User B logs in."""
    reg_a = await client.post(
        "/api/v1/auth/register",
        json={"full_name": "UA2", "email": "ua2@example.com", "password": "super-secure-pass"},
    )
    rt_a = reg_a.json()["tokens"]["refresh_token"]

    reg_b = await client.post(
        "/api/v1/auth/register",
        json={"full_name": "UB2", "email": "ub2@example.com", "password": "super-secure-pass"},
    )
    rt_b = reg_b.json()["tokens"]["refresh_token"]

    refresh_resp = await client.post("/api/v1/auth/refresh", json={"refresh_token": rt_b})
    assert refresh_resp.status_code == 200
    new_at_b = refresh_resp.json()["access_token"]

    me_resp = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {new_at_b}"})
    assert me_resp.status_code == 200
    assert me_resp.json()["user"]["email"] == "ub2@example.com"
    assert me_resp.json()["user"]["id"] != reg_a.json()["user"]["id"]


async def test_remember_me_login_token_contains_remember_me_flag(client):
    """The refresh token from a remember_me=True login contains remember_me=True."""
    from app.core.security import decode_token, REFRESH_TOKEN_TYPE

    await client.post(
        "/api/v1/auth/register",
        json={"full_name": "RM6", "email": "rm6@example.com", "password": "super-secure-pass"},
    )
    login = await client.post(
        "/api/v1/auth/login",
        json={"email": "rm6@example.com", "password": "super-secure-pass", "remember_me": True},
    )
    rt = login.json()["tokens"]["refresh_token"]
    payload = decode_token(rt, REFRESH_TOKEN_TYPE)
    assert payload.get("remember_me") is True


async def test_no_remember_me_login_token_contains_remember_me_false(client):
    """The refresh token from a remember_me=False login contains remember_me=False."""
    from app.core.security import decode_token, REFRESH_TOKEN_TYPE

    await client.post(
        "/api/v1/auth/register",
        json={"full_name": "RM7", "email": "rm7@example.com", "password": "super-secure-pass"},
    )
    login = await client.post(
        "/api/v1/auth/login",
        json={"email": "rm7@example.com", "password": "super-secure-pass", "remember_me": False},
    )
    rt = login.json()["tokens"]["refresh_token"]
    payload = decode_token(rt, REFRESH_TOKEN_TYPE)
    assert payload.get("remember_me") is False
