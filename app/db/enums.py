"""Domain enumerations shared across the application.

These enums are intentionally defined outside the SQLAlchemy model modules so
runtime code can import them without pulling the ORM into the process. The
legacy model modules re-export them for Alembic / the data-migration script.
"""

from enum import Enum


class TransactionType(str, Enum):
    income = "income"
    expense = "expense"


class TransactionSource(str, Enum):
    manual = "manual"
    bank = "bank"
    upi = "upi"
    card = "card"
    import_ = "import"


class SavingsGoalStatus(str, Enum):
    active = "active"
    completed = "completed"
    paused = "paused"
    abandoned = "abandoned"


class ConsentType(str, Enum):
    financial_data_analysis = "financial_data_analysis"
    personalized_recommendations = "personalized_recommendations"
    chat_financial_context = "chat_financial_context"
    ml_analysis = "ml_analysis"


class ConsentStatus(str, Enum):
    granted = "granted"
    revoked = "revoked"
