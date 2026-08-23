"""Contract tests for the business profile endpoints (GET/PATCH /users/me/business)."""

TEST_PROFILE = {
    "business_name": "Maa's Tiffin Center",
    "business_type": "food",
    "state": "Odisha",
}


async def test_business_profile_empty_by_default(client, consented_headers):
    response = await client.get("/api/v1/users/me/business", headers=consented_headers)
    assert response.status_code == 200
    body = response.json()
    assert body["business_name"] is None
    assert body["business_type"] is None


async def test_business_profile_roundtrip(client, consented_headers):
    patch = await client.patch(
        "/api/v1/users/me/business", json=TEST_PROFILE, headers=consented_headers
    )
    assert patch.status_code == 200
    assert patch.json()["business_name"] == TEST_PROFILE["business_name"]
    assert patch.json()["business_type"] == TEST_PROFILE["business_type"]

    get = await client.get("/api/v1/users/me/business", headers=consented_headers)
    assert get.status_code == 200
    body = get.json()
    assert body["business_name"] == TEST_PROFILE["business_name"]
    assert body["state"] == TEST_PROFILE["state"]

    clear = await client.patch(
        "/api/v1/users/me/business",
        json={"business_name": ""},
        headers=consented_headers,
    )
    assert clear.status_code == 200
    assert clear.json()["business_name"] is None


async def test_business_profile_requires_auth(client):
    response = await client.get("/api/v1/users/me/business")
    assert response.status_code == 401

    patch = await client.patch("/api/v1/users/me/business", json=TEST_PROFILE)
    assert patch.status_code == 401


async def test_business_profile_isolated_per_user(client):
    async def register(email: str) -> dict:
        response = await client.post(
            "/api/v1/auth/register",
            json={
                "full_name": f"User {email}",
                "email": email,
                "password": "strong-password-123",
            },
        )
        return {"Authorization": f"Bearer {response.json()['tokens']['access_token']}"}

    first = await register("biz-a@example.com")
    patch = await client.patch(
        "/api/v1/users/me/business", json=TEST_PROFILE, headers=first
    )
    assert patch.status_code == 200

    second = await register("biz-b@example.com")
    response = await client.get("/api/v1/users/me/business", headers=second)
    assert response.status_code == 200
    body = response.json()
    assert body["business_name"] is None
    assert body["business_type"] is None

    other = await client.get("/api/v1/users/me/business", headers=first)
    assert other.json()["business_name"] == TEST_PROFILE["business_name"]
