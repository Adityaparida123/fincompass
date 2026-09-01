"""Business Hub services."""

from datetime import date
from decimal import Decimal

from app.db.mongo import Doc, MongoDatabase
from app.schemas.business import (
    BusinessProfileCreate,
    CustomerCreate,
    PurchaseCreate,
    SaleCreate,
)


BUSINESS_PROFILE_COLLECTION = "business_profiles"
BUSINESS_SALES_COLLECTION = "business_sales"
BUSINESS_CUSTOMERS_COLLECTION = "business_customers"
BUSINESS_PURCHASES_COLLECTION = "business_purchases"


# ============================================================
# HELPERS
# ============================================================

def _decimal(value) -> Decimal:
    """Safely convert values to Decimal."""
    if value is None:
        return Decimal("0")
    return Decimal(str(value))


def _calculate_item_total(item) -> Decimal:
    """Calculate one item's total."""

    if item.amount is not None:
        return _decimal(item.amount)

    return _decimal(item.quantity) * _decimal(item.unit_price)


def _prepare_items(items):
    """Prepare item documents and calculate complete bill total."""

    prepared = []
    total = Decimal("0")

    for item in items:
        item_total = _calculate_item_total(item)

        prepared.append(
            {
                "name": item.name,
                "quantity": item.quantity,
                "unit": item.unit,
                "unit_price": item.unit_price,
                "total": item_total,
            }
        )

        total += item_total

    return prepared, total


# ============================================================
# BUSINESS PROFILE
# ============================================================

async def create_business_profile(
    db: MongoDatabase,
    user_id: int,
    data: BusinessProfileCreate,
) -> Doc:
    """Create a business profile once per user."""

    existing = await db.find_one(
        BUSINESS_PROFILE_COLLECTION,
        {"user_id": user_id},
    )

    if existing is not None:
        return existing

    return await db.insert(
        BUSINESS_PROFILE_COLLECTION,
        {
            "user_id": user_id,
            "business_name": data.business_name,
            "business_type": data.business_type,
            "location": data.location,
            "opening_cash": data.opening_cash,
        },
    )


async def get_business_profile(
    db: MongoDatabase,
    user_id: int,
) -> Doc | None:
    return await db.find_one(
        BUSINESS_PROFILE_COLLECTION,
        {"user_id": user_id},
    )


# ============================================================
# SALES
# ============================================================

async def create_sale(
    db: MongoDatabase,
    user_id: int,
    data: SaleCreate,
) -> Doc:
    """
    Create a quick or detailed sale.

    Payment rules:

    Cash / UPI:
        paid defaults to total.

    Credit:
        paid defaults to 0.

    Partial payment:
        user can explicitly provide paid_amount.

    Due:
        total - paid.
    """

    sale_date = data.date or date.today()

    # ----------------------------------------
    # Calculate total
    # ----------------------------------------

    if data.items:
        items, total_amount = _prepare_items(data.items)
    else:
        items = []
        total_amount = _decimal(data.amount)

    # ----------------------------------------
    # Calculate payment
    # ----------------------------------------

    payment_method = (
        data.payment_method.strip().lower()
        if data.payment_method
        else None
    )

    if data.paid_amount is not None:
        paid_amount = _decimal(data.paid_amount)

    elif payment_method in {"cash", "upi", "online", "card"}:
        paid_amount = total_amount

    elif payment_method in {"credit", "due", "udhaar"}:
        paid_amount = Decimal("0")

    else:
        # Safe default:
        # if payment method wasn't specified,
        # treat it as fully paid.
        paid_amount = total_amount

    if paid_amount > total_amount:
        raise ValueError(
            "Paid amount cannot be greater than the sale total."
        )

    due_amount = total_amount - paid_amount

    # ----------------------------------------
    # Customer handling
    # ----------------------------------------

    customer_id = data.customer_id
    customer_name = data.customer_name

    customer = None

    # If customer ID is provided, make sure
    # it belongs to this user.
    if customer_id is not None:
        customer = await db.find_one(
            BUSINESS_CUSTOMERS_COLLECTION,
            {
                "id": customer_id,
                "user_id": user_id,
            },
        )

        if customer is None:
            raise ValueError("Customer not found.")

        customer_name = customer.name

    # If only a customer name is supplied,
    # automatically find/create the customer.
    elif customer_name:
        customer = await db.find_one(
            BUSINESS_CUSTOMERS_COLLECTION,
            {
                "user_id": user_id,
                "name": customer_name,
            },
        )

        if customer is None:
            customer = await db.insert(
                BUSINESS_CUSTOMERS_COLLECTION,
                {
                    "user_id": user_id,
                    "name": customer_name,
                    "phone": None,
                    "address": None,
                    "total_purchased": Decimal("0"),
                    "total_paid": Decimal("0"),
                    "total_due": Decimal("0"),
                },
            )

        customer_id = customer.id

    # ----------------------------------------
    # Save sale
    # ----------------------------------------

    sale = await db.insert(
        BUSINESS_SALES_COLLECTION,
        {
            "user_id": user_id,
            "customer_id": customer_id,
            "customer_name": customer_name,
            "items": items,
            "total_amount": total_amount,
            "paid_amount": paid_amount,
            "due_amount": due_amount,
            "payment_method": payment_method,
            "date": sale_date,
            "notes": data.notes,
        },
    )

    # ----------------------------------------
    # Update customer totals
    # ----------------------------------------

    if customer_id is not None:
        customer = await db.find_one(
            BUSINESS_CUSTOMERS_COLLECTION,
            {
                "id": customer_id,
                "user_id": user_id,
            },
        )

        if customer is not None:
            old_purchased = _decimal(
                customer.get("total_purchased", 0)
            )
            old_paid = _decimal(
                customer.get("total_paid", 0)
            )
            old_due = _decimal(
                customer.get("total_due", 0)
            )

            await db.update_one(
                BUSINESS_CUSTOMERS_COLLECTION,
                {
                    "id": customer_id,
                    "user_id": user_id,
                },
                {
                    "total_purchased": old_purchased + total_amount,
                    "total_paid": old_paid + paid_amount,
                    "total_due": old_due + due_amount,
                },
            )

    return sale


async def get_sale(
    db: MongoDatabase,
    user_id: int,
    sale_id: int,
) -> Doc | None:
    return await db.find_one(
        BUSINESS_SALES_COLLECTION,
        {
            "id": sale_id,
            "user_id": user_id,
        },
    )


async def list_sales(
    db: MongoDatabase,
    user_id: int,
    limit: int = 100,
) -> list[Doc]:
    return await db.find(
        BUSINESS_SALES_COLLECTION,
        {"user_id": user_id},
        sort=[
            ("date", -1),
            ("created_at", -1),
        ],
        limit=limit,
    )


# ============================================================
# CUSTOMERS
# ============================================================

async def create_customer(
    db: MongoDatabase,
    user_id: int,
    data: CustomerCreate,
) -> Doc:
    """Create a customer."""

    existing = await db.find_one(
        BUSINESS_CUSTOMERS_COLLECTION,
        {
            "user_id": user_id,
            "name": data.name,
        },
    )

    if existing is not None:
        return existing

    return await db.insert(
        BUSINESS_CUSTOMERS_COLLECTION,
        {
            "user_id": user_id,
            "name": data.name,
            "phone": data.phone,
            "address": data.address,
            "total_purchased": Decimal("0"),
            "total_paid": Decimal("0"),
            "total_due": Decimal("0"),
        },
    )


async def get_customer(
    db: MongoDatabase,
    user_id: int,
    customer_id: int,
) -> Doc | None:
    return await db.find_one(
        BUSINESS_CUSTOMERS_COLLECTION,
        {
            "id": customer_id,
            "user_id": user_id,
        },
    )


async def list_customers(
    db: MongoDatabase,
    user_id: int,
    limit: int = 100,
) -> list[Doc]:
    return await db.find(
        BUSINESS_CUSTOMERS_COLLECTION,
        {"user_id": user_id},
        sort=[("name", 1)],
        limit=limit,
    )


# ============================================================
# PURCHASES
# ============================================================

async def create_purchase(
    db: MongoDatabase,
    user_id: int,
    data: PurchaseCreate,
) -> Doc:
    """Create a quick or detailed purchase."""

    purchase_date = data.date or date.today()

    if data.items:
        items, total_amount = _prepare_items(data.items)
    else:
        items = []
        total_amount = _decimal(data.amount)

    return await db.insert(
        BUSINESS_PURCHASES_COLLECTION,
        {
            "user_id": user_id,
            "items": items,
            "total_amount": total_amount,
            "supplier_name": data.supplier_name,
            "date": purchase_date,
            "notes": data.notes,
        },
    )


async def list_purchases(
    db: MongoDatabase,
    user_id: int,
    limit: int = 100,
) -> list[Doc]:
    return await db.find(
        BUSINESS_PURCHASES_COLLECTION,
        {"user_id": user_id},
        sort=[
            ("date", -1),
            ("created_at", -1),
        ],
        limit=limit,
    )


# ============================================================
# BUSINESS ANALYTICS
# ============================================================

async def get_business_summary(
    db: MongoDatabase,
    user_id: int,
) -> dict:
    """
    Basic Business Hub dashboard analytics.

    Includes:
    - total sales
    - total purchases
    - estimated profit
    - profit margin
    - customer due
    - transaction counts
    """

    sales = await list_sales(
        db,
        user_id,
        limit=1000,
    )

    purchases = await list_purchases(
        db,
        user_id,
        limit=1000,
    )

    customers = await list_customers(
        db,
        user_id,
        limit=1000,
    )

    total_sales = sum(
        (
            _decimal(s.get("total_amount", 0))
            for s in sales
        ),
        Decimal("0"),
    )

    total_purchases = sum(
        (
            _decimal(p.get("total_amount", 0))
            for p in purchases
        ),
        Decimal("0"),
    )

    total_due = sum(
        (
            _decimal(c.get("total_due", 0))
            for c in customers
        ),
        Decimal("0"),
    )

    total_paid = sum(
        (
            _decimal(s.get("paid_amount", 0))
            for s in sales
        ),
        Decimal("0"),
    )

    estimated_profit = total_sales - total_purchases

    if total_sales > 0:
        profit_margin = (
            estimated_profit / total_sales
        ) * Decimal("100")
    else:
        profit_margin = Decimal("0")

    return {
        "total_sales": total_sales,
        "total_purchases": total_purchases,
        "estimated_profit": estimated_profit,
        "profit_margin": profit_margin,
        "customer_due": total_due,
        "total_paid": total_paid,
        "sales_count": len(sales),
        "purchase_count": len(purchases),
        "customer_count": len(customers),
    }
