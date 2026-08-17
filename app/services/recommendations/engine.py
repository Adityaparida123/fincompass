"""Recommendations engine.

Produces prioritized, deterministic recommendations. Optimizes for financial
resilience — never for loan conversion.

Priority order:
1. Budgeting
2. Expense reduction
3. Savings
4. Emergency fund
5. Public schemes
6. Non-credit alternatives
7. Responsible borrowing
"""

from datetime import date

from app.schemas.recommendation import RecommendationOut, RecommendationsResult
from app.services.readiness.engine import ReadinessInput

ZERO = 0
CENTS = "0.01"


def _money(v) -> str:
    return f"{v:,.2f}"


def generate_recommendations(data: ReadinessInput, forecast_data: dict | None = None) -> RecommendationsResult:
    recommendations: list[RecommendationOut] = []
    priority = 1

    income = data.income
    outflow = data.total_expenses + data.debt_payments

    if income <= 0:
        recommendations.append(
            RecommendationOut(
                type="income",
                priority=priority,
                title="Track and stabilize your income",
                reason="No consistent income data was detected. Recording income helps estimate "
                "savings capacity and cash flow.",
            )
        )
        priority += 1

    savings_rate = (income - outflow) / income if income > 0 else 0
    months = (
        data.savings / data.essential_monthly_expenses
        if data.essential_monthly_expenses > 0
        else 0
    )

    if data.total_expenses > 0 and data.essential_monthly_expenses > 0:
        essential_share = (data.essential_monthly_expenses / data.total_expenses) * 100
        if essential_share > 80:
            recommendations.append(
                RecommendationOut(
                    type="budgeting",
                    priority=priority,
                    title="Review essential spending",
                    reason=f"Essential expenses make up {essential_share:.0f}% of your spending; "
                    "a detailed budget could reveal structural savings.",
                )
            )
            priority += 1

    if data.debt_payments > 0 and income > 0:
        debt_ratio = (data.debt_payments / income) * 100
        if debt_ratio > 30:
            recommendations.append(
                RecommendationOut(
                    type="expense_reduction",
                    priority=priority,
                    title="Lower debt pressure first",
                    reason=f"Debt payments consume {debt_ratio:.0f}% of income; prioritize "
                    "repayment or restructuring before new borrowing.",
                )
            )
            priority += 1
        else:
            recommendations.append(
                RecommendationOut(
                    type="debt",
                    priority=priority,
                    title="Plan debt repayment",
                    reason="Maintain consistent debt payments and review refinancing options "
                    "to reduce interest costs.",
                )
            )
            priority += 1

    if savings_rate > 0 and savings_rate < 10:
        recommendations.append(
            RecommendationOut(
                type="budgeting",
                priority=priority,
                title="Set a realistic budget",
                reason=f"Savings rate is only {savings_rate * 100:.1f}%. A budget can free up "
                "cash for savings.",
            )
        )
        priority += 1

    if months < 1:
        recommendations.append(
            RecommendationOut(
                type="emergency_fund",
                priority=priority,
                title="Build an emergency fund",
                reason="Your emergency buffer is currently limited. Aim for at least one month "
                "of essential expenses, then grow toward six.",
            )
        )
        priority += 1
    elif months < 6:
        recommendations.append(
            RecommendationOut(
                type="emergency_fund",
                priority=priority,
                title="Increase emergency savings",
                reason=f"Your emergency buffer covers {months:.1f} months; building toward six "
                "months increases resilience.",
            )
        )
        priority += 1

    if savings_rate > 0:
        recommendations.append(
            RecommendationOut(
                type="savings",
                priority=priority,
                title="Automate monthly savings",
                reason=f"You can save about {_money(outflow and income - outflow)} monthly based "
                "on current patterns. Automating this makes it consistent.",
            )
        )
        priority += 1

    if income > 0:
        recommendations.append(
            RecommendationOut(
                type="schemes",
                priority=priority,
                title="Check relevant public schemes",
                reason="Government schemes may offer savings incentives, subsidies, or support "
                "you qualify for. Eligibility is verified with official sources only.",
            )
        )
        priority += 1

    recommendations.append(
        RecommendationOut(
            type="non_credit_alternatives",
            priority=priority,
            title="Consider non-credit alternatives first",
            reason="Budgeting, savings, and public support should come before any borrowing.",
        )
    )
    priority += 1

    if income > 0 and outflow < income:
        recommendations.append(
            RecommendationOut(
                type="responsible_borrowing",
                priority=priority,
                title="Only borrow when necessary and affordable",
                reason="If borrowing is genuinely needed, ensure EMI stays well within cash "
                "flow and compare alternatives first.",
            )
        )

    # Forecast-based recommendations
    if forecast_data and forecast_data.get("status") == "success":
        expense_fc = forecast_data.get("expense_forecast")
        income_fc = forecast_data.get("income_forecast")
        cat_fcsts = forecast_data.get("category_forecasts", [])

        if expense_fc and income_fc:
            projected_surplus = income_fc["predicted"] - expense_fc["predicted"]
            if projected_surplus < 0:
                recommendations.append(
                    RecommendationOut(
                        type="forecast_alert",
                        priority=priority,
                        title="Projected expenses exceed income",
                        reason=(
                            f"Your projected expenses ({expense_fc['predicted']:,.0f}) "
                            f"exceed projected income ({income_fc['predicted']:,.0f}) "
                            f"by {abs(projected_surplus):,.0f}. "
                            "Review discretionary spending to avoid a deficit."
                        ),
                    )
                )
                priority += 1

        # Per-category alerts (top 3 over-budget categories)
        if cat_fcsts:
            for cf in cat_fcsts[:3]:
                if cf["category"] == "income":
                    continue
                # Only suggest monitoring for discretionary categories
                if cf["predicted"] > 0 and cf["category"] in (
                    "food", "shopping", "entertainment", "subscriptions"
                ):
                    if cf["months_of_data"] >= 2 and cf["upper"] > cf["predicted"] * 1.1:
                        recommendations.append(
                            RecommendationOut(
                                type="category_forecast",
                                priority=priority,
                                title=f"Monitor {cf['category']} spending",
                                reason=(
                                    f"Projected {cf['category']} spending is "
                                    f"{cf['predicted']:,.0f}/month. "
                                    "Consider reviewing this category for potential savings."
                                ),
                            )
                        )
                        priority += 1
                        break  # Only one category recommendation to avoid noise

    return RecommendationsResult(
        recommendations=recommendations,
        generated_at=str(date.today()),
    )
