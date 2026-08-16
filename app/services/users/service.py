"""User account management: hard delete with full data cascade.

Deleting an account removes the user document and every document owned by
that user across all Mongo collections. Related child records that do not
carry a ``user_id`` (chat messages by session, readiness factors by score)
are removed first so no orphan rows remain.
"""

from app.db.mongo import Doc, MongoDatabase

# Collections whose documents are scoped directly by ``user_id``.
_USER_SCOPED_COLLECTIONS = (
    "transactions",
    "budgets",
    "savings_goals",
    "debt_obligations",
    "consents",
    "refresh_token_sessions",
    "ml_predictions",
    "notifications",
    "recycle_bin",
    "audit_logs",
)


async def delete_account(db: MongoDatabase, user: Doc) -> dict[str, int]:
    """Hard-delete a user and all their data, returning per-collection counts."""
    user_id = user.id
    deleted: dict[str, int] = {}

    session_ids = [s.id for s in await db.find("chat_sessions", {"user_id": user_id})]
    if session_ids:
        deleted["chat_messages"] = await db.delete_many(
            "chat_messages", {"session_id": {"$in": session_ids}}
        )
        deleted["chat_sessions"] = await db.delete_many("chat_sessions", {"id": {"$in": session_ids}})

    score_ids = [s.id for s in await db.find("readiness_scores", {"user_id": user_id})]
    if score_ids:
        deleted["readiness_factors"] = await db.delete_many(
            "readiness_factors", {"readiness_score_id": {"$in": score_ids}}
        )
        deleted["readiness_scores"] = await db.delete_many(
            "readiness_scores", {"id": {"$in": score_ids}}
        )

    for collection in _USER_SCOPED_COLLECTIONS:
        count = await db.delete_many(collection, {"user_id": user_id})
        if count:
            deleted[collection] = count

    deleted["users"] = await db.delete_many("users", {"id": user_id})
    return deleted
