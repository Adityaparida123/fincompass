"""Consent service. Personalised features require matching granted consent."""

from datetime import UTC, datetime

from app.core.exceptions import ConflictError, ConsentDeniedError, NotFoundError
from app.db.enums import ConsentStatus, ConsentType
from app.db.mongo import Doc, MongoDatabase
from app.services.audit import log_audit


async def list_consents(db: MongoDatabase, user_id: int) -> list[Doc]:
    return await db.find("consents", {"user_id": user_id}, sort=[("consent_type", 1)])


async def get_consent(
    db: MongoDatabase, user_id: int, consent_type: ConsentType
) -> Doc | None:
    return await db.find_one(
        "consents",
        {"user_id": user_id, "consent_type": consent_type.value},
    )


async def require_consent(
    db: MongoDatabase, user_id: int, consent_type: ConsentType
) -> None:
    """Raise ConsentDeniedError when the user has not granted the consent."""
    consent = await get_consent(db, user_id, consent_type)
    if consent is None or consent.status != ConsentStatus.granted.value:
        raise ConsentDeniedError(
            f"Consent '{consent_type.value}' is required for this feature. "
            "Grant it from your consent settings."
        )


async def grant_consent(
    db: MongoDatabase, user_id: int, consent_type: ConsentType, version: int = 1
) -> Doc:
    existing = await get_consent(db, user_id, consent_type)
    now = datetime.now(UTC)
    if existing is None:
        consent = await db.insert(
            "consents",
            {
                "user_id": user_id,
                "consent_type": consent_type.value,
                "status": ConsentStatus.granted.value,
                "granted_at": now,
                "revoked_at": None,
                "version": version,
            },
        )
    else:
        if existing.status == ConsentStatus.granted.value:
            return existing
        await db.update_one(
            "consents",
            {"id": existing.id},
            {
                "status": ConsentStatus.granted.value,
                "granted_at": now,
                "revoked_at": None,
                "version": max(existing.version, version),
            },
        )
        consent = await db.find_one("consents", {"id": existing.id})
    await log_audit(
        db,
        action="consent.grant",
        resource_type="consent",
        user_id=user_id,
        resource_id=consent_type.value,
    )
    return consent


async def revoke_consent(
    db: MongoDatabase, user_id: int, consent_type: ConsentType
) -> None:
    consent = await get_consent(db, user_id, consent_type)
    if consent is None:
        raise NotFoundError(f"Consent '{consent_type.value}' not found.")
    await db.update_one(
        "consents",
        {"id": consent.id},
        {
            "status": ConsentStatus.revoked.value,
            "revoked_at": datetime.now(UTC),
        },
    )
    await log_audit(
        db,
        action="consent.revoke",
        resource_type="consent",
        user_id=user_id,
        resource_id=consent_type.value,
    )
