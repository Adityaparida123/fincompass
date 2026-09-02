"""Build ReadinessInput from the user's actual consented financial data."""

from datetime import date
from decimal import Decimal

from app.db.enums import TransactionType
from app.db.mongo import MongoDatabase
from app.schemas.transaction import is_essential
from app.services.readiness.engine import ReadinessInput

HISTORY_MONTHS = 3

# Category mappings for Cash Flow Statement
CFO_INCOME_CATEGORIES = {
    "sales", "revenue", "service", "consulting", "income", "business_income",
    "salary", "wages", "commission", "tips", "interest_income", "dividend_income"
}

CFO_EXPENSE_CATEGORIES = {
    "rent", "utilities", "wages", "salaries", "payroll", "supplies", "office",
    "marketing", "advertising", "insurance", "professional_fees", "legal",
    "accounting", "software", "subscriptions", "internet", "phone", "transport",
    "travel", "meals", "entertainment", "maintenance", "repairs", "cleaning",
    "security", "taxes", "licenses", "permits", "bank_fees", "payment_processing",
    "inventory", "cost_of_goods_sold", "cogs", "raw_materials", "packaging",
    "shipping", "delivery", "postage", "printing", "stationery"
}

CFI_CATEGORIES = {
    "equipment", "machinery", "vehicles", "property", "real_estate", "building",
    "land", "furniture", "fixtures", "computers", "technology", "software_capital",
    "capital_expenditure", "capex", "asset_purchase", "investment", "acquisition",
    "construction", "renovation", "improvements", "tools", "instruments"
}

CFF_INCOME_CATEGORIES = {
    "loan_proceeds", "loan_received", "borrowing", "credit_line", "overdraft",
    "owner_contribution", "capital_injection", "equity_investment", "investor_funding",
    "grant_received", "subsidy_received"
}

CFF_EXPENSE_CATEGORIES = {
    "loan_repayment", "loan_payment", "principal_payment", "debt_repayment",
    "owner_withdrawal", "drawings", "dividend_paid", "distribution",
    "interest_payment", "interest_expense", "finance_cost", "loan_interest"
}


def _classify_cash_flow(category: str, transaction_type: TransactionType, amount: Decimal) -> tuple[str, Decimal]:
    """Classify a transaction into CFO, CFI, or CFF."""
    cat_lower = category.strip().lower()
    
    if transaction_type == TransactionType.income:
        if cat_lower in CFO_INCOME_CATEGORIES:
            return "cfo", amount
        elif cat_lower in CFI_CATEGORIES:
            return "cfi", amount
        elif cat_lower in CFF_INCOME_CATEGORIES:
            return "cff", amount
        else:
            # Default income to CFO
            return "cfo", amount
    else:  # expense
        if cat_lower in CFI_CATEGORIES:
            return "cfi", -amount
        elif cat_lower in CFF_EXPENSE_CATEGORIES:
            return "cff", -amount
        elif cat_lower in CFO_EXPENSE_CATEGORIES:
            return "cfo", -amount
        else:
            # Default expense to CFO
            return "cfo", -amount


async def _monthly_totals(
    db: MongoDatabase,
    user_id: int,
    tx_type: TransactionType,
    start: date,
    end: date,
) -> dict[str, Decimal]:
    filt = {
        "user_id": user_id,
        "transaction_type": tx_type.value,
        "is_deleted": False,
        "date": {"$gte": start, "$lt": end},
    }
    totals: dict[str, Decimal] = {}
    for row in await db.find("transactions", filt):
        key = row.date[:7]
        totals[key] = totals.get(key, Decimal("0")) + row.amount
    return totals


async def _monthly_cash_flow_breakdown(
    db: MongoDatabase,
    user_id: int,
    start: date,
    end: date,
) -> tuple[Decimal, Decimal, Decimal, Decimal]:
    """Calculate CFO, CFI, CFF and revenue from transactions."""
    filt = {
        "user_id": user_id,
        "is_deleted": False,
        "date": {"$gte": start, "$lt": end},
    }
    
    cfo_total = Decimal("0")
    cfi_total = Decimal("0")
    cff_total = Decimal("0")
    revenue_total = Decimal("0")
    
    for row in await db.find("transactions", filt):
        flow_type, amount = _classify_cash_flow(row.category, row.transaction_type, row.amount)
        if flow_type == "cfo":
            cfo_total += amount
        elif flow_type == "cfi":
            cfi_total += amount
        elif flow_type == "cff":
            cff_total += amount
        
        # Track revenue (operating income)
        if row.transaction_type == TransactionType.income and row.category.strip().lower() in CFO_INCOME_CATEGORIES:
            revenue_total += row.amount
    
    return cfo_total, cfi_total, cff_total, revenue_total


async def _month_bounds(today: date) -> list[tuple[date, date]]:
    bounds: list[tuple[date, date]] = []
    year, month = today.year, today.month
    for _ in range(HISTORY_MONTHS):
        start = date(year, month, 1)
        end = date(year, month + 1, 1) if month < 12 else date(year + 1, 1, 1)
        bounds.append((start, end))
        if month == 1:
            year, month = year - 1, 12
        else:
            month -= 1
    return list(reversed(bounds))


async def build_readiness_input(db: MongoDatabase, user_id: int) -> ReadinessInput:
    today = date.today()
    bounds = await _month_bounds(today)
    window_start = bounds[0][0]
    window_end = bounds[-1][1]

    income_by_month = await _monthly_totals(db, user_id, TransactionType.income, window_start, window_end)
    expense_by_month = await _monthly_totals(db, user_id, TransactionType.expense, window_start, window_end)

    essential_by_month: dict[str, Decimal] = {}
    filt = {
        "user_id": user_id,
        "transaction_type": TransactionType.expense.value,
        "is_deleted": False,
        "date": {"$gte": window_start, "$lt": window_end},
    }
    for row in await db.find("transactions", filt):
        if is_essential(row.category):
            key = row.date[:7]
            essential_by_month[key] = essential_by_month.get(key, Decimal("0")) + row.amount

    # Calculate cash flow breakdown (CFO, CFI, CFF) and revenue
    cfo_total, cfi_total, cff_total, revenue_total = await _monthly_cash_flow_breakdown(
        db, user_id, window_start, window_end
    )

    def _month_key(start: date) -> str:
        return start.isoformat()[:7]

    income_months = [income_by_month.get(_month_key(start), Decimal("0")) for start, _ in bounds]
    expense_months = [expense_by_month.get(_month_key(start), Decimal("0")) for start, _ in bounds]
    essential_months = [essential_by_month.get(_month_key(start), Decimal("0")) for start, _ in bounds]

    monthly_debt = await db.sum_field("debt_obligations", {"user_id": user_id}, "monthly_payment")
    savings = await db.sum_field("savings_goals", {"user_id": user_id}, "current_amount")

    def _avg(values: list[Decimal]) -> Decimal:
        return (sum(values) / Decimal(len(values))).quantize(Decimal("0.01")) if values else Decimal("0")

    return ReadinessInput(
        income=_avg(income_months),
        total_expenses=_avg(expense_months),
        essential_monthly_expenses=_avg(essential_months),
        debt_payments=monthly_debt,
        savings=savings,
        income_months=income_months,
        expense_months=expense_months,
        cfo=cfo_total,
        cfi=cfi_total,
        cff=cff_total,
        revenue=revenue_total,
    )
