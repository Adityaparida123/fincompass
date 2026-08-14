"""Index specification tests (MongoDB facade)."""

from app.db.indexes import _INDEX_SPECS, ensure_indexes


def test_index_specs_cover_all_runtime_collections():
    runtime_collections = {
        "users",
        "transactions",
        "budgets",
        "savings_goals",
        "debt_obligations",
        "consents",
        "audit_logs",
        "refresh_token_sessions",
        "ml_predictions",
        "readiness_scores",
        "readiness_factors",
        "chat_sessions",
        "chat_messages",
        "notifications",
        "government_schemes",
        "recycle_bin",
    }
    assert set(_INDEX_SPECS) == runtime_collections


def test_readiness_factor_index_uses_document_field():
    """Indexes must reference fields that documents actually carry.

    readiness_factors documents store ``readiness_score_id`` (the numeric id of
    the parent readiness score) and are queried with that field only.
    """
    keys_list = [keys for keys, _ in _INDEX_SPECS["readiness_factors"]]
    assert any("readiness_score_id" in dict(keys) for keys in keys_list), (
        "readiness_factors index must cover readiness_score_id"
    )
    assert not any("score_id" in dict(keys) for keys in keys_list), (
        "readiness_factors documents have no score_id field"
    )


async def test_ensure_indexes_is_idempotent(db_session):
    first = await ensure_indexes(db_session)
    second = await ensure_indexes(db_session)
    assert first == second
    assert set(first) == set(_INDEX_SPECS)
