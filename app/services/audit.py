"""Audit logging service.

Only non-sensitive metadata is logged. Never store passwords, tokens,
API keys, or raw financial values here.
"""

import json
from typing import Any

from app.db.mongo import MongoDatabase


async def log_audit(
    db: MongoDatabase,
    action: str,
    resource_type: str,
    *,
    user_id: int | None = None,
    resource_id: str | int | None = None,
    metadata: dict[str, Any] | None = None,
) -> None:
    safe_meta = _sanitize(metadata)
    await db.insert(
        "audit_logs",
        {
            "user_id": user_id,
            "action": action,
            "resource_type": resource_type,
            "resource_id": str(resource_id) if resource_id is not None else None,
            "metadata_payload": safe_meta,
        },
    )


_SENSITIVE_KEYS = {
    "password",
    "password_hash",
    "token",
    "access_token",
    "refresh_token",
    "api_key",
    "secret",
    "otp",
    "pin",
    "cvv",
    "private_key",
}


def _sanitize(metadata: dict[str, Any] | None) -> dict[str, Any] | None:
    if not metadata:
        return metadata
    clean: dict[str, Any] = {}
    for key, value in metadata.items():
        if key.lower() in _SENSITIVE_KEYS or any(s in key.lower() for s in _SENSITIVE_KEYS):
            clean[key] = "[redacted]"
        elif isinstance(value, dict):
            clean[key] = _sanitize(value)
        elif isinstance(value, (list, tuple)):
            clean[key] = [_sanitize(v) if isinstance(v, dict) else v for v in value]
        else:
            clean[key] = value
    return clean


def safe_json(value: Any) -> str:
    return json.dumps(value, default=str, ensure_ascii=False)
