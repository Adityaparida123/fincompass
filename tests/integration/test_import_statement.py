"""Integration tests for the bank statement import endpoints."""

from decimal import Decimal

from app.core.config import settings
from tests.unit.statement_fixtures import INDIAN_STATEMENT_CSV

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


async def test_analyze_full_pipeline_fields(client, consented_headers):
    response = await _upload(client, consented_headers, content=INDIAN_STATEMENT_CSV)
    assert response.status_code == 200
    payload = response.json()

    assert payload["total_rows"] == 19
    assert payload["expenses_count"] == 16
    assert payload["income_count"] == 3
    assert payload["duplicate_count"] == 0
    assert payload["possible_duplicate_count"] == 1
    assert payload["recurring_count"] == 2
    assert payload["new_count"] == 18
    assert payload["message"] and "possible duplicate" in payload["message"].lower()

    by_number = {t["row_number"]: t for t in payload["transactions"]}

    swiggy = by_number[1]
    assert swiggy["merchant"] == "Swiggy"
    assert swiggy["category"] == "food"
    assert swiggy["subcategory"] == "restaurant"
    assert swiggy["duplicate_status"] == "new"
    assert swiggy["needs_review"] is False

    possible = by_number[3]
    assert possible["description"].startswith("UPI/DR/320/UBER")
    assert possible["duplicate_status"] == "possible_duplicate"
    assert possible["is_duplicate"] is False

    atm = by_number[4]
    assert atm["merchant"] == "ATM"
    assert atm["movement_type"] == "cash_withdrawal"

    rent = by_number[5]
    assert rent["category"] == "housing"
    assert rent["subcategory"] == "rent"
    assert rent["movement_type"] == "expense"

    netflix = by_number[11]
    assert netflix["category"] == "subscriptions"
    assert netflix["subcategory"] == "streaming"
    assert netflix["recurring"] is True
    assert by_number[18]["recurring"] is True

    transfer = by_number[15]
    assert transfer["movement_type"] == "transfer"

    salary = by_number[19]
    assert salary["transaction_type"] == "income"
    assert salary["category"] == "income"
    assert salary["movement_type"] == "income"
    assert salary["merchant"] == "ABC PVT LTD"
    assert salary["confidence_label"] in {"high", "good"}


async def test_confirm_persists_merchant_and_subcategory(client, consented_headers, db_session):
    response = await _upload(client, consented_headers, content=INDIAN_STATEMENT_CSV)
    preview = response.json()["transactions"]
    swiggy = next(t for t in preview if t["row_number"] == 1)
    items = [
        {
            "date": swiggy["date"],
            "description": swiggy["description"],
            "amount": swiggy["amount"],
            "transaction_type": swiggy["transaction_type"],
            "category": swiggy["category"],
            "subcategory": swiggy["subcategory"],
            "merchant": swiggy["merchant"],
        }
    ]
    confirm = await client.post(
        "/api/v1/transactions/import-statement/confirm",
        json={"transactions": items},
        headers=consented_headers,
    )
    assert confirm.status_code == 200
    assert confirm.json()["imported_count"] == 1

    listed = await client.get("/api/v1/transactions", headers=consented_headers)
    assert listed.json()["total"] == 1
    assert listed.json()["items"][0]["merchant"] == "Swiggy"

    stored = await db_session.find("transactions", {"is_deleted": False})
    assert len(stored) == 1
    assert stored[0].merchant == "Swiggy"
    assert stored[0].subcategory == "restaurant"
    assert stored[0].amount == Decimal("450.00")


async def test_analyze_handles_corrupt_file(client, consented_headers):
    response = await _upload(
        client, consented_headers, content=b"\x00\x01\x02\xff\xfe\xfd" * 50, name="broken.csv"
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "INVALID_INPUT"
