"""Consent endpoints."""

from fastapi import APIRouter, Depends

from app.api.dependencies import get_current_user
from app.db.models.consent import ConsentType
from app.db.mongo import Doc, MongoDatabase
from app.db.session import get_session
from app.schemas.consent import ConsentGrantRequest, ConsentList, ConsentRead
from app.services.consent.service import grant_consent, list_consents, revoke_consent

router = APIRouter(prefix="/consent", tags=["consent"])


@router.get("", response_model=ConsentList)
async def get_consents(
    user: Doc = Depends(get_current_user),
    db: MongoDatabase = Depends(get_session),
) -> ConsentList:
    consents = await list_consents(db, user.id)
    return ConsentList(items=[ConsentRead.model_validate(c) for c in consents])


@router.post("", response_model=ConsentRead, status_code=201)
async def grant(
    data: ConsentGrantRequest,
    user: Doc = Depends(get_current_user),
    db: MongoDatabase = Depends(get_session),
) -> ConsentRead:
    consent = await grant_consent(db, user.id, data.consent_type, data.version)
    return ConsentRead.model_validate(consent)


@router.delete("/{consent_type}", status_code=200)
async def revoke(
    consent_type: ConsentType,
    user: Doc = Depends(get_current_user),
    db: MongoDatabase = Depends(get_session),
) -> dict:
    await revoke_consent(db, user.id, consent_type)
    return {"message": f"Consent '{consent_type.value}' revoked."}
