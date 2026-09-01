"""Business Hub API routes."""

from fastapi import APIRouter, Depends

from app.api.dependencies import get_current_user
from app.db.mongo import MongoDatabase
from app.db.session import get_session
from app.schemas.business import (
    BusinessProfileCreate,
    BusinessProfileRead,
    CustomerCreate,
    CustomerRead,
    PurchaseCreate,
    PurchaseRead,
    SaleCreate,
    SaleRead,
)
from app.services.business.services import (
    create_business_profile,
    create_customer,
    create_purchase,
    create_sale,
    get_business_profile,
    get_business_summary,
    get_customer,
    get_sale,
    list_customers,
    list_purchases,
    list_sales,
)


router = APIRouter(
    prefix="/business",
    tags=["business"],
)


# ============================================================
# BUSINESS PROFILE
# ============================================================

@router.post(
    "/profile",
    response_model=BusinessProfileRead,
    status_code=201,
)
async def create_profile(
    data: BusinessProfileCreate,
    user=Depends(get_current_user),
    db: MongoDatabase = Depends(get_session),
):
    profile = await create_business_profile(
        db,
        user.id,
        data,
    )

    return BusinessProfileRead.model_validate(profile)


@router.get(
    "/profile",
    response_model=BusinessProfileRead | None,
)
async def get_profile(
    user=Depends(get_current_user),
    db: MongoDatabase = Depends(get_session),
):
    profile = await get_business_profile(
        db,
        user.id,
    )

    if profile is None:
        return None

    return BusinessProfileRead.model_validate(profile)


# ============================================================
# SALES
# ============================================================

@router.post(
    "/sales",
    response_model=SaleRead,
    status_code=201,
)
async def add_sale(
    data: SaleCreate,
    user=Depends(get_current_user),
    db: MongoDatabase = Depends(get_session),
):
    sale = await create_sale(
        db,
        user.id,
        data,
    )

    return SaleRead.model_validate(sale)


@router.get(
    "/sales",
    response_model=list[SaleRead],
)
async def get_sales(
    user=Depends(get_current_user),
    db: MongoDatabase = Depends(get_session),
):
    sales = await list_sales(
        db,
        user.id,
    )

    return [
        SaleRead.model_validate(sale)
        for sale in sales
    ]


@router.get(
    "/sales/{sale_id}",
    response_model=SaleRead,
)
async def get_single_sale(
    sale_id: int,
    user=Depends(get_current_user),
    db: MongoDatabase = Depends(get_session),
):
    sale = await get_sale(
        db,
        user.id,
        sale_id,
    )

    if sale is None:
        from app.core.exceptions import NotFoundError

        raise NotFoundError("Sale not found.")

    return SaleRead.model_validate(sale)


# ============================================================
# CUSTOMERS
# ============================================================

@router.post(
    "/customers",
    response_model=CustomerRead,
    status_code=201,
)
async def add_customer(
    data: CustomerCreate,
    user=Depends(get_current_user),
    db: MongoDatabase = Depends(get_session),
):
    customer = await create_customer(
        db,
        user.id,
        data,
    )

    return CustomerRead.model_validate(customer)


@router.get(
    "/customers",
    response_model=list[CustomerRead],
)
async def get_customers(
    user=Depends(get_current_user),
    db: MongoDatabase = Depends(get_session),
):
    customers = await list_customers(
        db,
        user.id,
    )

    return [
        CustomerRead.model_validate(customer)
        for customer in customers
    ]


@router.get(
    "/customers/{customer_id}",
    response_model=CustomerRead,
)
async def get_single_customer(
    customer_id: int,
    user=Depends(get_current_user),
    db: MongoDatabase = Depends(get_session),
):
    customer = await get_customer(
        db,
        user.id,
        customer_id,
    )

    if customer is None:
        from app.core.exceptions import NotFoundError

        raise NotFoundError("Customer not found.")

    return CustomerRead.model_validate(customer)


# ============================================================
# PURCHASES
# ============================================================

@router.post(
    "/purchases",
    response_model=PurchaseRead,
    status_code=201,
)
async def add_purchase(
    data: PurchaseCreate,
    user=Depends(get_current_user),
    db: MongoDatabase = Depends(get_session),
):
    purchase = await create_purchase(
        db,
        user.id,
        data,
    )

    return PurchaseRead.model_validate(purchase)


@router.get(
    "/purchases",
    response_model=list[PurchaseRead],
)
async def get_purchases(
    user=Depends(get_current_user),
    db: MongoDatabase = Depends(get_session),
):
    purchases = await list_purchases(
        db,
        user.id,
    )

    return [
        PurchaseRead.model_validate(purchase)
        for purchase in purchases
    ]


# ============================================================
# SUMMARY
# ============================================================

@router.get(
    "/summary",
)
async def business_summary(
    user=Depends(get_current_user),
    db: MongoDatabase = Depends(get_session),
):
    return await get_business_summary(
        db,
        user.id,
    )
