"""Tests for the notification service, API endpoints, and trigger integration."""

import pytest


# ---------------------------------------------------------------------------
# Service-layer unit tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_notify_creates_notification(db_session):
    from app.services.notifications.service import notify

    doc = await notify(db_session, user_id=1, title="Test", message="Body", ntype="system")
    assert doc.title == "Test"
    assert doc.message == "Body"
    assert doc.type == "system"
    assert doc.is_read is False
    assert doc.user_id == 1


@pytest.mark.asyncio
async def test_list_notifications(db_session):
    from app.services.notifications.service import list_notifications, notify

    await notify(db_session, 1, "A", "a1")
    await notify(db_session, 1, "B", "b1")
    await notify(db_session, 2, "C", "c1")

    items = await list_notifications(db_session, user_id=1)
    assert len(items) == 2
    titles = {i.title for i in items}
    assert titles == {"A", "B"}


@pytest.mark.asyncio
async def test_list_notifications_unread_only(db_session):
    from app.services.notifications.service import list_notifications, mark_read, notify

    n1 = await notify(db_session, 1, "A", "a1")
    await notify(db_session, 1, "B", "b1")
    await mark_read(db_session, 1, n1.id)

    unread = await list_notifications(db_session, user_id=1, unread_only=True)
    assert len(unread) == 1
    assert unread[0].title == "B"


@pytest.mark.asyncio
async def test_unread_count(db_session):
    from app.services.notifications.service import notify, unread_count, mark_read

    n1 = await notify(db_session, 1, "A", "a1")
    await notify(db_session, 1, "B", "b1")
    assert await unread_count(db_session, 1) == 2

    await mark_read(db_session, 1, n1.id)
    assert await unread_count(db_session, 1) == 1


@pytest.mark.asyncio
async def test_mark_read(db_session):
    from app.services.notifications.service import mark_read, notify

    n = await notify(db_session, 1, "A", "a1")
    updated = await mark_read(db_session, 1, n.id)
    assert updated.is_read is True


@pytest.mark.asyncio
async def test_mark_read_not_found_raises(db_session):
    from app.core.exceptions import NotFoundError
    from app.services.notifications.service import mark_read

    with pytest.raises(NotFoundError):
        await mark_read(db_session, user_id=1, notification_id=9999)


@pytest.mark.asyncio
async def test_mark_all_read(db_session):
    from app.services.notifications.service import mark_all_read, notify, unread_count

    await notify(db_session, 1, "A", "a1")
    await notify(db_session, 1, "B", "b1")
    assert await unread_count(db_session, 1) == 2

    count = await mark_all_read(db_session, 1)
    assert count == 2
    assert await unread_count(db_session, 1) == 0


@pytest.mark.asyncio
async def test_delete_notification(db_session):
    from app.services.notifications.service import delete_notification, list_notifications, notify

    n = await notify(db_session, 1, "A", "a1")
    await delete_notification(db_session, 1, n.id)
    items = await list_notifications(db_session, 1)
    assert len(items) == 0


@pytest.mark.asyncio
async def test_delete_notification_not_found_raises(db_session):
    from app.core.exceptions import NotFoundError
    from app.services.notifications.service import delete_notification

    with pytest.raises(NotFoundError):
        await delete_notification(db_session, user_id=1, notification_id=9999)


@pytest.mark.asyncio
async def test_user_isolation(db_session):
    from app.services.notifications.service import list_notifications, notify

    await notify(db_session, 1, "User1", "u1")
    await notify(db_session, 2, "User2", "u2")

    u1_items = await list_notifications(db_session, 1)
    assert len(u1_items) == 1
    assert u1_items[0].title == "User1"

    u2_items = await list_notifications(db_session, 2)
    assert len(u2_items) == 1
    assert u2_items[0].title == "User2"


# ---------------------------------------------------------------------------
# API endpoint tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_api_create_notification(client, auth_headers):
    resp = await client.post(
        "/api/v1/notifications",
        json={"title": "Hello", "message": "World", "type": "system"},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "Hello"
    assert data["is_read"] is False


@pytest.mark.asyncio
async def test_api_list_notifications(client, auth_headers):
    await client.post(
        "/api/v1/notifications",
        json={"title": "N1", "message": "m1"},
        headers=auth_headers,
    )
    resp = await client.get("/api/v1/notifications", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] >= 1
    assert data["unread"] >= 1


@pytest.mark.asyncio
async def test_api_mark_read(client, auth_headers):
    create_resp = await client.post(
        "/api/v1/notifications",
        json={"title": "N1", "message": "m1"},
        headers=auth_headers,
    )
    n_id = create_resp.json()["id"]

    patch_resp = await client.patch(f"/api/v1/notifications/{n_id}/read", headers=auth_headers)
    assert patch_resp.status_code == 200
    assert patch_resp.json()["is_read"] is True


@pytest.mark.asyncio
async def test_api_mark_all_read(client, auth_headers):
    await client.post(
        "/api/v1/notifications",
        json={"title": "N1", "message": "m1"},
        headers=auth_headers,
    )
    await client.post(
        "/api/v1/notifications",
        json={"title": "N2", "message": "m2"},
        headers=auth_headers,
    )

    resp = await client.patch("/api/v1/notifications/read-all", headers=auth_headers)
    assert resp.status_code == 200
    assert "2" in resp.json()["message"]

    list_resp = await client.get("/api/v1/notifications", headers=auth_headers)
    assert list_resp.json()["unread"] == 0


@pytest.mark.asyncio
async def test_api_delete_notification(client, auth_headers):
    create_resp = await client.post(
        "/api/v1/notifications",
        json={"title": "N1", "message": "m1"},
        headers=auth_headers,
    )
    n_id = create_resp.json()["id"]

    del_resp = await client.delete(f"/api/v1/notifications/{n_id}", headers=auth_headers)
    assert del_resp.status_code == 200


@pytest.mark.asyncio
async def test_api_unauthenticated_rejected(client):
    resp = await client.get("/api/v1/notifications")
    assert resp.status_code in (401, 403)


@pytest.mark.asyncio
async def test_api_cross_user_isolation(client):
    """Users cannot see each other's notifications."""
    r1 = await client.post(
        "/api/v1/auth/register",
        json={"full_name": "U1", "email": "u1@iso.com", "password": "strong-password-123"},
    )
    h1 = {"Authorization": f"Bearer {r1.json()['tokens']['access_token']}"}

    r2 = await client.post(
        "/api/v1/auth/register",
        json={"full_name": "U2", "email": "u2@iso.com", "password": "strong-password-456"},
    )
    h2 = {"Authorization": f"Bearer {r2.json()['tokens']['access_token']}"}

    await client.post(
        "/api/v1/notifications",
        json={"title": "Private", "message": "Secret"},
        headers=h1,
    )

    list_resp = await client.get("/api/v1/notifications", headers=h2)
    assert list_resp.json()["total"] == 0


# ---------------------------------------------------------------------------
# Budget notification triggers
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_budget_status_fires_warning_at_80_percent(db_session, client, consented_headers):
    """Budget status endpoint creates a notification when spending >= 80%."""
    user_id = 1
    # Insert expenses that put us at 85% of a 10000 budget
    await db_session.insert(
        "transactions",
        {
            "user_id": user_id,
            "date": "2026-08-05",
            "description": "groceries",
            "amount": 8500,
            "currency": "INR",
            "transaction_type": "expense",
            "category": "groceries",
            "is_deleted": False,
        },
    )

    await client.post(
        "/api/v1/budget",
        json={"period": "2026-08-01", "category": "groceries", "limit_amount": "10000"},
        headers=consented_headers,
    )

    # Call budget status (triggers notification check)
    resp = await client.get("/api/v1/budget/status?period=2026-08", headers=consented_headers)
    assert resp.status_code == 200

    # Check notifications were created
    notif_resp = await client.get("/api/v1/notifications", headers=consented_headers)
    notifs = notif_resp.json()["items"]
    budget_warnings = [n for n in notifs if n["type"] == "budget_warning"]
    assert len(budget_warnings) >= 1
    assert "groceries" in budget_warnings[0]["title"]


@pytest.mark.asyncio
async def test_budget_status_fires_exceeded_at_100_percent(db_session, client, consented_headers):
    """Budget status endpoint creates an exceeded notification when spending >= 100%."""
    user_id = 1
    await db_session.insert(
        "transactions",
        {
            "user_id": user_id,
            "date": "2026-08-05",
            "description": "food spend",
            "amount": 12000,
            "currency": "INR",
            "transaction_type": "expense",
            "category": "food",
            "is_deleted": False,
        },
    )

    await client.post(
        "/api/v1/budget",
        json={"period": "2026-08-01", "category": "food", "limit_amount": "10000"},
        headers=consented_headers,
    )

    await client.get("/api/v1/budget/status?period=2026-08", headers=consented_headers)

    notif_resp = await client.get("/api/v1/notifications", headers=consented_headers)
    budget_exceeded = [n for n in notif_resp.json()["items"] if n["type"] == "budget_exceeded"]
    assert len(budget_exceeded) >= 1
    assert "exceeded" in budget_exceeded[0]["title"].lower()


@pytest.mark.asyncio
async def test_budget_status_no_notification_below_80_percent(db_session, client, consented_headers):
    """No notification when spending is below 80%."""
    user_id = 1
    await db_session.insert(
        "transactions",
        {
            "user_id": user_id,
            "date": "2026-08-05",
            "description": "food",
            "amount": 5000,
            "currency": "INR",
            "transaction_type": "expense",
            "category": "food",
            "is_deleted": False,
        },
    )

    await client.post(
        "/api/v1/budget",
        json={"period": "2026-08-01", "category": "food", "limit_amount": "10000"},
        headers=consented_headers,
    )

    await client.get("/api/v1/budget/status?period=2026-08", headers=consented_headers)

    notif_resp = await client.get("/api/v1/notifications", headers=consented_headers)
    budget_notifs = [n for n in notif_resp.json()["items"] if n["type"].startswith("budget_")]
    assert len(budget_notifs) == 0
