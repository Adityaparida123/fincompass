"""Deterministic financial tools exposed to the LLM.

The LLM selects tools; the backend executes them using the financial engine.
The LLM never performs the calculations itself.
"""

from dataclasses import dataclass
from decimal import Decimal
from typing import Any, Callable, Coroutine

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.transaction import Transaction, TransactionType
from app.schemas.cashflow import CashFlowInput, SavingsCapacityInput
from app.schemas.debt import DebtBurdenInput
from app.schemas.loan import EMICalculateRequest, LoanSimulationRequest
from app.schemas.savings import EmergencyBufferInput
from app.schemas.scheme import SchemeMatchInput
from app.services.finance.cashflow import calculate_cash_flow, calculate_savings_capacity
from app.services.finance.debt import calculate_debt_burden
from app.services.finance.emergency_fund import calculate_emergency_buffer
from app.services.finance.expenses import category_totals, expense_series, income_totals
from app.services.lending.emi import emi_result
from app.services.lending.loan_simulator import simulate_loan
from app.services.readiness.engine import ReadinessInput, compute_readiness
from app.services.schemes.matcher import match_schemes


@dataclass
class ToolContext:
    db: AsyncSession
    user_id: int
    session_id: int | None = None


TOOL_SPECS: list[dict[str, Any]] = [
    {
        "type": "function",
        "function": {
            "name": "calculate_emi",
            "description": "Compute the monthly EMI, total interest, and total payment for a loan.",
            "parameters": {
                "type": "object",
                "properties": {
                    "principal": {"type": "number", "description": "Loan amount."},
                    "annual_interest_rate": {"type": "number", "description": "Annual interest rate in percent."},
                    "tenure_months": {"type": "integer", "description": "Repayment tenure in months."},
                },
                "required": ["principal", "annual_interest_rate", "tenure_months"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "calculate_cash_flow",
            "description": "Calculate available cash flow from income, essential/discretionary expenses, and debt payments.",
            "parameters": {
                "type": "object",
                "properties": {
                    "income": {"type": "number"},
                    "essential_expenses": {"type": "number"},
                    "discretionary_expenses": {"type": "number"},
                    "debt_payments": {"type": "number"},
                },
                "required": ["income", "essential_expenses", "discretionary_expenses", "debt_payments"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "calculate_savings_capacity",
            "description": "Estimate monthly savings capacity and savings rate from income, expenses, and debt payments.",
            "parameters": {
                "type": "object",
                "properties": {
                    "income": {"type": "number"},
                    "expenses": {"type": "number"},
                    "debt_payments": {"type": "number"},
                },
                "required": ["income", "expenses", "debt_payments"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "analyze_expenses",
            "description": "Analyze the user's consented expense data (total, by category, and trend).",
            "parameters": {
                "type": "object",
                "properties": {"months": {"type": "integer", "description": "Lookback months, default 3."}},
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "calculate_debt_burden",
            "description": "Calculate the share of monthly income consumed by debt payments.",
            "parameters": {
                "type": "object",
                "properties": {"monthly_income": {"type": "number"}, "monthly_debt_payments": {"type": "number"}},
                "required": ["monthly_income", "monthly_debt_payments"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "calculate_emergency_buffer",
            "description": "Calculate how many months of essential expenses the user's savings cover.",
            "parameters": {
                "type": "object",
                "properties": {"savings": {"type": "number"}, "essential_monthly_expenses": {"type": "number"}},
                "required": ["savings", "essential_monthly_expenses"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "calculate_credit_readiness",
            "description": "Compute the explainable 0-100 credit readiness score using consented financial data.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "simulate_loan",
            "description": "Simulate a loan: EMI, post-loan cash flow, debt burden, warnings, and alternatives.",
            "parameters": {
                "type": "object",
                "properties": {
                    "income": {"type": "number"},
                    "monthly_expenses": {"type": "number"},
                    "existing_debt_payment": {"type": "number"},
                    "loan_amount": {"type": "number"},
                    "interest_rate": {"type": "number"},
                    "tenure_months": {"type": "integer"},
                },
                "required": ["income", "monthly_expenses", "existing_debt_payment", "loan_amount", "interest_rate", "tenure_months"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_financial_summary",
            "description": "Summarize the user's consented income, expenses, cash flow, savings rate, and readiness.",
            "parameters": {
                "type": "object",
                "properties": {"months": {"type": "integer", "description": "Lookback months, default 3."}},
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_user_goals",
            "description": "List the user's savings goals and their progress.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "find_government_schemes",
            "description": "Find potentially relevant government schemes based on user profile.",
            "parameters": {
                "type": "object",
                "properties": {"income": {"type": "number"}, "age": {"type": "integer"}},
            },
        },
    },
]

TOOL_REGISTRY: dict[str, Callable[[ToolContext, dict[str, Any]], Coroutine[Any, Any, Any]]] = {}


def _register(name: str):
    def decorator(fn):
        TOOL_REGISTRY[name] = fn
        return fn

    return decorator


def _to_dict(model: Any) -> dict[str, Any]:
    return model.model_dump(mode="json")


async def _execute_expense_analysis(ctx: ToolContext, months: int) -> dict[str, Any]:
    from datetime import date

    from app.utils.dates import add_months

    end = date.today()
    start = add_months(end.replace(day=1), -months)
    cat_rows = await category_totals(db=ctx.db, user_id=ctx.user_id, start=start, end=end)
    income = await income_totals(ctx.db, ctx.user_id, start, end)
    series = await expense_series(ctx.db, ctx.user_id, start, end, "month")
    total_expenses = sum((t for _, t, _ in cat_rows), Decimal("0"))
    return {
        "period_start": start.isoformat(),
        "period_end": end.isoformat(),
        "total_expenses": str(total_expenses),
        "total_income": str(income),
        "categories": {cat: str(t) for cat, t, _ in cat_rows},
        "monthly_trend": {k: str(v) for k, v in series.items()},
    }


@_register("calculate_emi")
async def tool_calculate_emi(ctx: ToolContext, args: dict[str, Any]) -> dict[str, Any]:
    req = EMICalculateRequest(
        principal=Decimal(str(args["principal"])),
        annual_interest_rate=Decimal(str(args["annual_interest_rate"])),
        tenure_months=int(args["tenure_months"]),
    )
    return _to_dict(emi_result(req.principal, req.annual_interest_rate, req.tenure_months))


@_register("calculate_cash_flow")
async def tool_calculate_cash_flow(ctx: ToolContext, args: dict[str, Any]) -> dict[str, Any]:
    data = CashFlowInput(
        income=Decimal(str(args["income"])),
        essential_expenses=Decimal(str(args.get("essential_expenses", 0))),
        discretionary_expenses=Decimal(str(args.get("discretionary_expenses", 0))),
        debt_payments=Decimal(str(args.get("debt_payments", 0))),
    )
    return _to_dict(calculate_cash_flow(data))


@_register("calculate_savings_capacity")
async def tool_calculate_savings_capacity(ctx: ToolContext, args: dict[str, Any]) -> dict[str, Any]:
    data = SavingsCapacityInput(
        income=Decimal(str(args["income"])),
        expenses=Decimal(str(args.get("expenses", 0))),
        debt_payments=Decimal(str(args.get("debt_payments", 0))),
    )
    return _to_dict(calculate_savings_capacity(data))


@_register("analyze_expenses")
async def tool_analyze_expenses(ctx: ToolContext, args: dict[str, Any]) -> dict[str, Any]:
    return await _execute_expense_analysis(ctx, int(args.get("months", 3)))


@_register("calculate_debt_burden")
async def tool_calculate_debt_burden(ctx: ToolContext, args: dict[str, Any]) -> dict[str, Any]:
    data = DebtBurdenInput(
        monthly_income=Decimal(str(args["monthly_income"])),
        monthly_debt_payments=Decimal(str(args["monthly_debt_payments"])),
    )
    return _to_dict(calculate_debt_burden(data))


@_register("calculate_emergency_buffer")
async def tool_calculate_emergency_buffer(ctx: ToolContext, args: dict[str, Any]) -> dict[str, Any]:
    data = EmergencyBufferInput(
        savings=Decimal(str(args["savings"])),
        essential_monthly_expenses=Decimal(str(args["essential_monthly_expenses"])),
    )
    return _to_dict(calculate_emergency_buffer(data))


@_register("calculate_credit_readiness")
async def tool_calculate_credit_readiness(ctx: ToolContext, args: dict[str, Any]) -> dict[str, Any]:
    from app.services.readiness.service import compute_and_store

    result = await compute_and_store(ctx.db, ctx.user_id)
    return _to_dict(result)


@_register("simulate_loan")
async def tool_simulate_loan(ctx: ToolContext, args: dict[str, Any]) -> dict[str, Any]:
    data = LoanSimulationRequest(
        income=Decimal(str(args["income"])),
        monthly_expenses=Decimal(str(args.get("monthly_expenses", 0))),
        existing_debt_payment=Decimal(str(args.get("existing_debt_payment", 0))),
        loan_amount=Decimal(str(args["loan_amount"])),
        interest_rate=Decimal(str(args["interest_rate"])),
        tenure_months=int(args["tenure_months"]),
    )
    return _to_dict(simulate_loan(data))


@_register("get_financial_summary")
async def tool_get_financial_summary(ctx: ToolContext, args: dict[str, Any]) -> dict[str, Any]:
    from app.services.readiness.factors import build_readiness_input

    data = await build_readiness_input(ctx.db, ctx.user_id)
    readiness = compute_readiness(data)
    analysis = await _execute_expense_analysis(ctx, int(args.get("months", 3)))
    return {
        "income": str(data.income),
        "total_expenses": str(data.total_expenses),
        "essential_monthly_expenses": str(data.essential_monthly_expenses),
        "debt_payments": str(data.debt_payments),
        "savings": str(data.savings),
        "savings_rate_percent": str(
            ((data.income - data.total_expenses - data.debt_payments) / data.income * 100).quantize(Decimal("0.01"))
            if data.income > 0
            else 0
        ),
        "credit_readiness": readiness.score,
        "readiness_summary": readiness.summary,
        "expense_breakdown": analysis,
    }


@_register("get_user_goals")
async def tool_get_user_goals(ctx: ToolContext, args: dict[str, Any]) -> dict[str, Any]:
    from sqlalchemy import select

    from app.db.models.savings import SavingsGoal

    stmt = select(SavingsGoal).where(SavingsGoal.user_id == ctx.user_id)
    goals = (await ctx.db.execute(stmt)).scalars().all()
    return {
        "goals": [
            {
                "id": g.id,
                "name": g.name,
                "target_amount": str(g.target_amount),
                "current_amount": str(g.current_amount),
                "target_date": g.target_date.isoformat() if g.target_date else None,
                "status": g.status,
            }
            for g in goals
        ]
    }


@_register("find_government_schemes")
async def tool_find_government_schemes(ctx: ToolContext, args: dict[str, Any]) -> dict[str, Any]:
    data = SchemeMatchInput(
        income=Decimal(str(args["income"])) if args.get("income") is not None else None,
        age=int(args["age"]) if args.get("age") is not None else None,
    )
    matches = await match_schemes(ctx.db, data)
    return {
        "matches": [
            {
                "name": m.scheme.name,
                "jurisdiction": m.scheme.jurisdiction,
                "benefits": m.scheme.benefits,
                "match_reason": m.match_reason,
                "confidence": m.confidence,
                "source_url": m.scheme.source_url,
                "disclaimer": m.disclaimer,
            }
            for m in matches
        ]
    }


async def execute_tool(ctx: ToolContext, name: str, args: dict[str, Any]) -> dict[str, Any]:
    fn = TOOL_REGISTRY.get(name)
    if fn is None:
        raise ValueError(f"Unknown tool: {name}")
    return await fn(ctx, args)
