"""Consent service. Personalised features require matching granted consent."""

from datetime import UTC, datetime

from app.core.exceptions import ConflictError, ConsentDeniedError, NotFoundError
from app.core.logging import get_logger
from app.db.enums import ConsentStatus, ConsentType
from app.db.mongo import Doc, MongoDatabase
from app.services.audit import log_audit
from app.utils.request_context import current_endpoint, current_request_id

logger = get_logger(__name__)


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
        exists = consent is not None
        status = consent.status if exists else "missing"
        logger.warning(
            "CONSENT_DENIED user_id=%s endpoint=%s consent_type=%s exists=%s status=%s request_id=%s",
            user_id,
            current_endpoint(),
            consent_type.value,
            exists,
            status,
            current_request_id() or "-",
        )
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


async def backfill_consents(db: MongoDatabase) -> int:
    """Ensure every active user has all required consent records.

    Safe for repeated runs (idempotent). Never overwrites an explicit
    revoked consent. Only creates records that are entirely missing.
    Returns the total number of consent records created.
    """
    users = await db.find("users", {"is_active": True})
    now = datetime.now(UTC)
    created = 0

    for user in users:
        user_id = user.id
        existing = await db.find(
            "consents",
            {"user_id": user_id},
        )
        existing_types = {c["consent_type"] for c in existing}

        for ct in ConsentType:
            if ct.value in existing_types:
                continue
            await db.insert(
                "consents",
                {
                    "user_id": user_id,
                    "consent_type": ct.value,
                    "status": ConsentStatus.granted.value,
                    "granted_at": now,
                    "revoked_at": None,
                    "version": 1,
                },
            )
            created += 1

    if created:
        logger.info("Consent backfill: created %d missing consent record(s).", created)
    return created
