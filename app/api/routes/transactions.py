"""Transaction routes with soft delete to recycle bin."""

from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, File, Query, UploadFile

from app.api.dependencies import get_current_user, rate_limit_statement
from app.db.enums import ConsentType, TransactionSource, TransactionType
from app.db.mongo import MongoDatabase
from app.db.session import get_session
from app.schemas.common import Page
from app.schemas.import_statement import (
    StatementAnalyzeResponse,
    StatementConfirmRequest,
    StatementConfirmResponse,
)
from app.schemas.transaction import TransactionCreate, TransactionRead, TransactionUpdate
from app.services.consent.service import require_consent
from app.services.finance.transactions import (
    amount_in_range,
    create_transaction,
    get_transaction,
    transaction_filter,
    update_transaction,
)
from app.services.import_statement.service import (
    analyze_statement_file,
    confirm_statement_import,
)
from app.services.recycle_bin.service import move_to_recycle_bin
from app.utils.pagination import paginate

router = APIRouter(prefix="/transactions", tags=["transactions"])


async def _require_financial_consent(db: MongoDatabase, user_id: int) -> None:
    await require_consent(db, user_id, ConsentType.financial_data_analysis)


@router.post("", response_model=TransactionRead, status_code=201)
async def create_tx(
    data: TransactionCreate,
    user=Depends(get_current_user),
    db: MongoDatabase = Depends(get_session),
):
    await _require_financial_consent(db, user.id)
    tx = await create_transaction(db, user.id, data)
    return TransactionRead.model_validate(tx)


@router.get("", response_model=Page[TransactionRead])
async def list_txs(
    transaction_type: TransactionType | None = None,
    category: str | None = None,
    start: date | None = None,
    end: date | None = None,
    source: TransactionSource | None = None,
    min_amount: float | None = Query(None, ge=0),
    max_amount: float | None = Query(None, ge=0),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
    user=Depends(get_current_user),
    db: MongoDatabase = Depends(get_session),
):
    await _require_financial_consent(db, user.id)
    filt = transaction_filter(
        user.id,
        transaction_type=transaction_type,
        category=category,
        start=start,
        end=end,
        source=source,
    )
    total = await db.count("transactions", filt)
    rows = await db.find(
        "transactions",
        filt,
        sort=[("date", -1), ("id", -1)],
        skip=(page - 1) * page_size,
        limit=page_size,
    )
    items = []
    for row in rows:
        if not amount_in_range(
            row.amount,
            min_amount=Decimal(min_amount) if min_amount is not None else None,
            max_amount=Decimal(max_amount) if max_amount is not None else None,
        ):
            continue
        items.append(TransactionRead.model_validate(row))
    return paginate(items, total, page, page_size)


@router.post(
    "/import-statement/analyze",
    response_model=StatementAnalyzeResponse,
    status_code=200,
)
async def analyze_statement(
    file: UploadFile = File(...),
    user=Depends(get_current_user),
    db: MongoDatabase = Depends(get_session),
    _=Depends(rate_limit_statement),
):
    """Parse an uploaded bank statement and return a reviewable preview.

    No data is persisted by this endpoint; the user reviews (and edits) the
    rows and only the confirmed selection is imported via ``/confirm``.
    """
    await _require_financial_consent(db, user.id)
    return await analyze_statement_file(db, user.id, file)


@router.post(
    "/import-statement/confirm",
    response_model=StatementConfirmResponse,
    status_code=200,
)
async def confirm_statement(
    data: StatementConfirmRequest,
    user=Depends(get_current_user),
    db: MongoDatabase = Depends(get_session),
):
    """Persist the user-confirmed statement transactions (duplicates skipped)."""
    await _require_financial_consent(db, user.id)
    return await confirm_statement_import(db, user.id, data.transactions)


@router.get("/{transaction_id}", response_model=TransactionRead)
async def get_tx(
    transaction_id: int,
    user=Depends(get_current_user),
    db: MongoDatabase = Depends(get_session),
) -> TransactionRead:
    await _require_financial_consent(db, user.id)
    tx = await get_transaction(db, user.id, transaction_id)
    return TransactionRead.model_validate(tx)


@router.patch("/{transaction_id}", response_model=TransactionRead)
async def patch_tx(
    transaction_id: int,
    data: TransactionUpdate,
    user=Depends(get_current_user),
    db: MongoDatabase = Depends(get_session),
) -> TransactionRead:
    await _require_financial_consent(db, user.id)
    tx = await update_transaction(db, user.id, transaction_id, data)
    return TransactionRead.model_validate(tx)


@router.delete("/{transaction_id}", status_code=200)
async def delete_tx(
    transaction_id: int,
    user=Depends(get_current_user),
    db: MongoDatabase = Depends(get_session),
) -> dict:
    await _require_financial_consent(db, user.id)
    tx = await get_transaction(db, user.id, transaction_id)
    await move_to_recycle_bin(db, user.id, "transaction", tx.id, tx)
    return {"message": "Transaction moved to recycle bin."}
