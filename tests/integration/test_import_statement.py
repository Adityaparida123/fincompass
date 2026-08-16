"""Integration tests for the bank statement import endpoints."""

from app.core.config import settings

CSV = (
    "Date,Narration,Withdrawal (Dr),Deposit (Cr)\n"
    "01/08/2026,Zomato,350.00,\n"
    "02/08/2026,Salary credit,,45000.00\n"
)


async def _upload(client, headers, content=CSV, name="stmt.csv"):
    return await client.post(
        "/api/v1/transactions/import-statement/analyze",
        files={"file": (name, content, "text/csv")},
        headers=headers,
    )


async def test_analyze_requires_auth(client):
    response = await client.post(
        "/api/v1/transactions/import-statement/analyze",
        files={"file": ("stmt.csv", CSV, "text/csv")},
    )
    assert response.status_code == 401


async def test_analyze_requires_consent(client, auth_headers):
    response = await _upload(client, auth_headers)
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "CONSENT_DENIED"


async def test_analyze_success(client, consented_headers):
    response = await _upload(client, consented_headers)
    assert response.status_code == 200
    payload = response.json()
    assert payload["file_name"] == "stmt.csv"
    assert payload["total_rows"] == 2
    assert payload["expenses_count"] == 1
    assert payload["income_count"] == 1
    assert payload["duplicate_count"] == 0

    txns = payload["transactions"]
    assert txns[0]["description"] == "Zomato"
    assert txns[0]["transaction_type"] == "expense"
    assert txns[0]["amount"] == "350.00"
    assert txns[1]["transaction_type"] == "income"
    assert txns[1]["category"] == "income"


async def test_analyze_unsupported_format(client, consented_headers):
    response = await _upload(client, consented_headers, content=b"hello", name="stmt.doc")
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "INVALID_INPUT"


async def test_analyze_empty_file(client, consented_headers):
    response = await _upload(client, consented_headers, content=b"", name="stmt.csv")
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "INVALID_INPUT"


async def test_analyze_too_large(client, consented_headers, monkeypatch):
    monkeypatch.setattr(settings, "MAX_UPLOAD_SIZE", 100)
    response = await _upload(client, consented_headers, content=b"x" * 200)
    assert response.status_code == 422
    assert "too large" in response.json()["error"]["message"].lower()


async def test_analyze_no_rows(client, consented_headers):
    response = await _upload(client, consented_headers, content="Date,Narration,Amount\n")
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "INVALID_INPUT"


async def test_confirm_requires_auth(client):
    response = await client.post(
        "/api/v1/transactions/import-statement/confirm",
        json={"transactions": []},
    )
    assert response.status_code == 401


async def test_confirm_imports(client, consented_headers, db_session):
    response = await _upload(client, consented_headers)
    preview = response.json()["transactions"]
    items = [
        {
            "date": t["date"],
            "description": t["description"],
            "amount": t["amount"],
            "transaction_type": t["transaction_type"],
            "category": t["category"],
        }
        for t in preview
    ]
    confirm = await client.post(
        "/api/v1/transactions/import-statement/confirm",
        json={"transactions": items},
        headers=consented_headers,
    )
    assert confirm.status_code == 200
    assert confirm.json()["imported_count"] == 2
    assert confirm.json()["duplicates_skipped"] == 0

    listed = await client.get("/api/v1/transactions", headers=consented_headers)
    assert listed.json()["total"] == 2


async def test_confirm_skips_duplicates_on_reimport(client, consented_headers):
    await _upload(client, consented_headers)
    await client.post(
        "/api/v1/transactions/import-statement/confirm",
        json={
            "transactions": [
                {
                    "date": "2026-08-01",
                    "description": "Zomato",
                    "amount": "350.00",
                    "transaction_type": "expense",
                    "category": "food",
                }
            ]
        },
        headers=consented_headers,
    )
    confirm = await client.post(
        "/api/v1/transactions/import-statement/confirm",
        json={
            "transactions": [
                {
                    "date": "2026-08-01",
                    "description": "Zomato",
                    "amount": "350.00",
                    "transaction_type": "expense",
                    "category": "food",
                }
            ]
        },
        headers=consented_headers,
    )
    assert confirm.status_code == 200
    assert confirm.json()["imported_count"] == 0
    assert confirm.json()["duplicates_skipped"] == 1


async def test_analyze_marks_existing_duplicate(client, consented_headers):
    await client.post(
        "/api/v1/transactions",
        json={
            "date": "2026-08-01",
            "description": "Zomato",
            "amount": 350,
            "transaction_type": "expense",
            "category": "food",
        },
        headers=consented_headers,
    )
    response = await _upload(client, consented_headers)
    assert response.status_code == 200
    payload = response.json()
    assert payload["duplicate_count"] == 1
    assert payload["transactions"][0]["is_duplicate"] is True
    assert "duplicate" in payload["message"].lower()
