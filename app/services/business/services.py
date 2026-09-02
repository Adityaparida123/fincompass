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
from app.services.finance.scope import SCOPE_BUSINESS, SCOPE_PERSONAL, classify_scope


BUSINESS_PROFILE_COLLECTION = "business_profiles"
BUSINESS_SALES_COLLECTION = "business_sales"
BUSINESS_CUSTOMERS_COLLECTION = "business_customers"
BUSINESS_PURCHASES_COLLECTION = "business_purchases"


# ============================================================
# HELPERS
# ============================================================


def _as_date(value) -> date | None:
    if value is None:
        return None
    if isinstance(value, date):
        return value
    if isinstance(value, str):
        try:
            return date.fromisoformat(value)
        except ValueError:
            return None
    return None


def _is_business_income(tx: Doc) -> bool:
    if str(tx.get("transaction_type", "")).lower() != "income":
        return False
    override = str(tx.get("expense_scope") or "").lower()
    if override == SCOPE_PERSONAL:
        return False
    if override == SCOPE_BUSINESS:
        return True
    category = str(tx.get("category") or "").strip().lower()
    return classify_scope(category) != SCOPE_PERSONAL


def _is_business_purchase(tx: Doc) -> bool:
    if str(tx.get("transaction_type", "")).lower() != "expense":
        return False
    override = str(tx.get("expense_scope") or "").lower()
    if override == SCOPE_PERSONAL:
        return False
    if override == SCOPE_BUSINESS:
        return True
    category = str(tx.get("category") or "").strip().lower()
    return classify_scope(category) == SCOPE_BUSINESS


async def _load_business_transactions(db: MongoDatabase, user_id: int) -> list[Doc]:
    return await db.find(
        "transactions",
        {"user_id": user_id, "is_deleted": False},
        sort=[("date", -1), ("id", -1)],
    )


async def _business_metrics_from_transactions(db: MongoDatabase, user_id: int) -> tuple[list[Doc], list[Doc]]:
    rows = await _load_business_transactions(db, user_id)
    sales = [row for row in rows if _is_business_income(row)]
    purchases = [row for row in rows if _is_business_purchase(row)]
    return sales, purchases


def _transaction_as_sale(transaction: Doc) -> Doc:
    amount = _decimal(transaction.get("amount"))
    return Doc(
        {
            "id": transaction["id"],
            "user_id": transaction["user_id"],
            "customer_id": None,
            "customer_name": transaction.get("merchant") or transaction.get("description"),
            "items": [],
            "total_amount": amount,
            "paid_amount": amount,
            "due_amount": Decimal("0"),
            "payment_method": "imported",
            "date": transaction.get("date"),
            "notes": transaction.get("description"),
        }
    )


def _transaction_as_purchase(transaction: Doc) -> Doc:
    return Doc(
        {
            "id": transaction["id"],
            "user_id": transaction["user_id"],
            "items": [],
            "total_amount": _decimal(transaction.get("amount")),
            "date": transaction.get("date"),
            "supplier_name": transaction.get("merchant") or transaction.get("description"),
            "notes": transaction.get("description"),
        }
    )

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
    manual_sales = await db.find(
        BUSINESS_SALES_COLLECTION,
        {"user_id": user_id},
        sort=[
            ("date", -1),
            ("created_at", -1),
        ],
        limit=limit,
    )
    imported_sales, _ = await _business_metrics_from_transactions(db, user_id)
    imported = [_transaction_as_sale(transaction) for transaction in imported_sales]
    return sorted(manual_sales + imported, key=lambda sale: str(sale.get("date") or ""), reverse=True)[:limit]


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
    manual_purchases = await db.find(
        BUSINESS_PURCHASES_COLLECTION,
        {"user_id": user_id},
        sort=[
            ("date", -1),
            ("created_at", -1),
        ],
        limit=limit,
    )
    _, imported_purchases = await _business_metrics_from_transactions(db, user_id)
    imported = [_transaction_as_purchase(transaction) for transaction in imported_purchases]
    return sorted(manual_purchases + imported, key=lambda purchase: str(purchase.get("date") or ""), reverse=True)[:limit]


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

    sales = await list_sales(db, user_id, limit=1000)
    purchases = await list_purchases(db, user_id, limit=1000)
    customers = await list_customers(db, user_id, limit=1000)

    total_sales = sum((_decimal(s.get("total_amount", 0)) for s in sales), Decimal("0"))
    total_purchases = sum((_decimal(p.get("total_amount", 0)) for p in purchases), Decimal("0"))
    total_due = sum((_decimal(c.get("total_due", 0)) for c in customers), Decimal("0"))
    total_paid = sum((_decimal(s.get("paid_amount", 0)) for s in sales), Decimal("0"))
    sales_count = len(sales)
    purchase_count = len(purchases)

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
        "sales_count": sales_count,
        "purchase_count": purchase_count,
        "customer_count": len(customers),
    }


async def get_business_dashboard(
    db: MongoDatabase,
    user_id: int,
    start_date: date,
    end_date: date,
) -> dict:
    """Return period metrics and a daily trend for the Business Dashboard."""
    sales = await list_sales(db, user_id, limit=1000)
    purchases = await list_purchases(db, user_id, limit=1000)

    def in_period(record: Doc) -> bool:
        recorded_on = _as_date(record.get("date"))
        return recorded_on is not None and start_date <= recorded_on <= end_date

    period_sales = [sale for sale in sales if in_period(sale)]
    period_purchases = [purchase for purchase in purchases if in_period(purchase)]

    buckets: dict[str, dict] = {}
    day = start_date
    while day <= end_date:
        buckets[day.isoformat()] = {
            "date": day.isoformat(),
            "sales": Decimal("0"),
            "purchases": Decimal("0"),
            "due": Decimal("0"),
        }
        day = date.fromordinal(day.toordinal() + 1)

    for sale in period_sales:
        sale_date = _as_date(sale.get("date"))
        if sale_date is None or sale_date.isoformat() not in buckets:
            continue
        buckets[sale_date.isoformat()]["sales"] += _decimal(sale.get("total_amount"))
        buckets[sale_date.isoformat()]["due"] += _decimal(sale.get("due_amount"))

    for purchase in period_purchases:
        purchase_date = _as_date(purchase.get("date"))
        if purchase_date is None or purchase_date.isoformat() not in buckets:
            continue
        buckets[purchase_date.isoformat()]["purchases"] += _decimal(purchase.get("total_amount"))

    trend = []
    for bucket in buckets.values():
        bucket["profit"] = bucket["sales"] - bucket["purchases"]
        trend.append(bucket)

    total_sales = sum((item["sales"] for item in trend), Decimal("0"))
    total_purchases = sum((item["purchases"] for item in trend), Decimal("0"))
    total_due = sum((item["due"] for item in trend), Decimal("0"))
    customer_ids = {sale.get("customer_id") for sale in period_sales if sale.get("customer_id") is not None}
    estimated_profit = total_sales - total_purchases

    return {
        "total_sales": total_sales,
        "total_purchases": total_purchases,
        "estimated_profit": estimated_profit,
        "customer_due": total_due,
        "customer_count": len(customer_ids),
        "transaction_count": len(period_sales) + len(period_purchases),
        "trend": trend,
    }


async def get_profit_ideas(db: MongoDatabase, user_id: int) -> list[dict[str, str]]:
    """Generate transparent, data-grounded actions to improve business profit."""
    today = date.today()
    current_start = date.fromordinal(today.toordinal() - 29)
    previous_start = date.fromordinal(today.toordinal() - 59)
    sales = await list_sales(db, user_id, limit=1000)
    purchases = await list_purchases(db, user_id, limit=1000)

    def recorded_on(record: Doc) -> date | None:
        value = record.get("date")
        if isinstance(value, str):
            return date.fromisoformat(value)
        return value if isinstance(value, date) else None

    def total(records: list[Doc], field: str, start: date, end: date) -> Decimal:
        return sum((_decimal(record.get(field)) for record in records if (day := recorded_on(record)) and start <= day <= end), Decimal("0"))

    monthly_sales = total(sales, "total_amount", current_start, today)
    monthly_purchases = total(purchases, "total_amount", current_start, today)
    monthly_due = total(sales, "due_amount", current_start, today)
    previous_sales = total(sales, "total_amount", previous_start, date.fromordinal(current_start.toordinal() - 1))
    profit = monthly_sales - monthly_purchases
    margin = (profit / monthly_sales * 100) if monthly_sales else Decimal("0")
    ideas: list[dict[str, str]] = []

    if monthly_sales == 0:
        ideas.append({"title": "Record every sale for one week", "reason": "Profit ideas become more accurate once daily sales and purchase costs are recorded.", "priority": "high"})
        return ideas
    if profit <= 0:
        ideas.append({"title": "Review prices and purchase costs first", "reason": f"Recorded purchases are ₹{monthly_purchases:,.0f} against sales of ₹{monthly_sales:,.0f} this month. Check supplier bills and the price of each item before adding new costs.", "priority": "high"})
    elif margin < 15:
        ideas.append({"title": "Improve low-margin items", "reason": f"Your estimated margin is {margin:.1f}%. Review items with frequent sales and consider a small price adjustment or a lower-cost supplier.", "priority": "high"})
    else:
        ideas.append({"title": "Protect your current margin", "reason": f"Your estimated margin is {margin:.1f}% this month. Keep recording purchase costs so price or supplier changes do not reduce it.", "priority": "medium"})
    if monthly_due > monthly_sales * Decimal("0.20"):
        ideas.append({"title": "Collect credit dues sooner", "reason": f"₹{monthly_due:,.0f} of this month's sales is still due. A clear due date or small reminder can improve cash available for stock.", "priority": "high"})
    if monthly_purchases > monthly_sales * Decimal("0.70"):
        ideas.append({"title": "Compare supplier costs", "reason": "Purchase costs use more than 70% of recorded sales. Compare two supplier quotes, buy fast-moving stock carefully, and avoid slow-moving items.", "priority": "medium"})
    if previous_sales > 0 and monthly_sales < previous_sales * Decimal("0.85"):
        decline = (1 - monthly_sales / previous_sales) * 100
        ideas.append({"title": "Bring back recent sales", "reason": f"Sales are {decline:.0f}% below the previous 30 days. Promote fast-moving items, ask regular customers what they need, or bundle complementary products.", "priority": "medium"})
    if len(ideas) < 3:
        ideas.append({"title": "Focus on fast-moving products", "reason": "Keep popular items available and review the purchase cost before restocking. Small, repeatable improvements usually increase profit more safely than large new expenses.", "priority": "low"})
    return ideas[:3]
