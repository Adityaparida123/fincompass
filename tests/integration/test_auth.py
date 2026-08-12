"""Integration tests for authentication flows."""


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
