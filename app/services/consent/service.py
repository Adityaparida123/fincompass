"""Consent service. Personalised features require matching granted consent."""

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, ConsentDeniedError, NotFoundError
from app.db.models.consent import Consent, ConsentStatus, ConsentType
from app.services.audit import log_audit


async def list_consents(db: AsyncSession, user_id: int) -> list[Consent]:
    stmt = select(Consent).where(Consent.user_id == user_id).order_by(Consent.consent_type)
    return list((await db.execute(stmt)).scalars().all())


async def get_consent(
    db: AsyncSession, user_id: int, consent_type: ConsentType
) -> Consent | None:
    stmt = select(Consent).where(
        Consent.user_id == user_id, Consent.consent_type == consent_type
    )
    return (await db.execute(stmt)).scalar_one_or_none()


async def require_consent(
    db: AsyncSession, user_id: int, consent_type: ConsentType
) -> None:
    """Raise ConsentDeniedError when the user has not granted the consent."""
    consent = await get_consent(db, user_id, consent_type)
    if consent is None or consent.status != ConsentStatus.granted:
        raise ConsentDeniedError(
            f"Consent '{consent_type.value}' is required for this feature. "
            "Grant it from your consent settings."
        )


async def grant_consent(
    db: AsyncSession, user_id: int, consent_type: ConsentType, version: int = 1
) -> Consent:
    existing = await get_consent(db, user_id, consent_type)
    now = datetime.now(UTC)
    if existing is None:
        consent = Consent(
            user_id=user_id,
            consent_type=consent_type,
            status=ConsentStatus.granted,
            granted_at=now,
            version=version,
        )
        db.add(consent)
    else:
        if existing.status == ConsentStatus.granted:
            raise ConflictError(f"Consent '{consent_type.value}' is already granted.")
        existing.status = ConsentStatus.granted
        existing.granted_at = now
        existing.revoked_at = None
        existing.version = max(existing.version, version)
        consent = existing
    await log_audit(
        db,
        action="consent.grant",
        resource_type="consent",
        user_id=user_id,
        resource_id=consent_type.value,
    )
    await db.flush()
    return consent


async def revoke_consent(
    db: AsyncSession, user_id: int, consent_type: ConsentType
) -> None:
    consent = await get_consent(db, user_id, consent_type)
    if consent is None:
        raise NotFoundError(f"Consent '{consent_type.value}' not found.")
    consent.status = ConsentStatus.revoked
    consent.revoked_at = datetime.now(UTC)
    await log_audit(
        db,
        action="consent.revoke",
        resource_type="consent",
        user_id=user_id,
        resource_id=consent_type.value,
    )
    await db.flush()
