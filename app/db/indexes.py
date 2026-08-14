"""MongoDB index initialization.

Run once at startup (and by the migration script). Indexes are idempotent:
``create_index`` is a no-op if an equivalent index already exists. The ``_id``
index is implicit; every document also carries a numeric ``id`` field managed by
the ``counters`` collection.
"""

from app.db.mongo import MongoDatabase

# collection -> list of (keys, unique)
_INDEX_SPECS: dict[str, list[tuple[list[tuple[str, int]], bool]]] = {
    "users": [
        ([("email", 1)], True),
        ([("id", 1)], False),
    ],
    "transactions": [
        ([("id", 1)], False),
        ([("user_id", 1)], False),
        ([("user_id", 1), ("is_deleted", 1), ("date", 1), ("category", 1)], False),
        ([("user_id", 1), ("transaction_type", 1), ("date", 1)], False),
    ],
    "budgets": [
        ([("id", 1)], False),
        ([("user_id", 1), ("period", 1), ("category", 1)], False),
    ],
    "savings_goals": [
        ([("id", 1)], False),
        ([("user_id", 1)], False),
    ],
    "debt_obligations": [
        ([("id", 1)], False),
        ([("user_id", 1)], False),
    ],
    "consents": [
        ([("id", 1)], False),
        ([("user_id", 1), ("consent_type", 1)], False),
    ],
    "audit_logs": [
        ([("id", 1)], False),
        ([("user_id", 1), ("created_at", 1)], False),
    ],
    "refresh_token_sessions": [
        ([("id", 1)], False),
        ([("user_id", 1)], False),
        ([("refresh_token_hash", 1)], True),
        ([("expires_at", 1)], False),
    ],
    "ml_predictions": [
        ([("id", 1)], False),
        ([("user_id", 1)], False),
    ],
    "readiness_scores": [
        ([("id", 1)], False),
        ([("user_id", 1), ("created_at", 1)], False),
    ],
    "readiness_factors": [
        ([("id", 1)], False),
        ([("user_id", 1), ("score_id", 1)], False),
    ],
    "chat_sessions": [
        ([("id", 1)], False),
        ([("user_id", 1), ("created_at", 1)], False),
    ],
    "chat_messages": [
        ([("id", 1)], False),
        ([("session_id", 1), ("created_at", 1)], False),
    ],
    "notifications": [
        ([("id", 1)], False),
        ([("user_id", 1), ("is_read", 1), ("created_at", 1)], False),
    ],
    "government_schemes": [
        ([("id", 1)], False),
        ([("name", 1)], True),
    ],
    "recycle_bin": [
        ([("id", 1)], False),
        ([("user_id", 1), ("created_at", 1)], False),
    ],
}


async def ensure_indexes(db: MongoDatabase) -> dict[str, int]:
    """Create all application indexes; return a {collection: index_count} map."""
    created: dict[str, int] = {}
    for collection, specs in _INDEX_SPECS.items():
        for keys, unique in specs:
            await db.create_index(collection, keys, unique=unique)
        created[collection] = len(specs)
    return created
