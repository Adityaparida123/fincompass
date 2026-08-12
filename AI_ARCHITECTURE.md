# FinAI Architecture

## Responsibilities

| Component | Does | Does NOT |
|-----------|------|----------|
| LLM | NLU, explanations, Hindi/English | Calculate money |
| Tools | Call deterministic backend | Invent figures |
| Safety | Block credential requests, reckless borrowing | Override tool results |

## Tools (12)

`calculate_emi`, `calculate_cash_flow`, `calculate_savings_capacity`, `analyze_expenses`, `create_budget`, `calculate_debt_burden`, `calculate_emergency_buffer`, `calculate_credit_readiness`, `simulate_loan`, `get_financial_summary`, `get_user_goals`, `find_government_schemes`

## Knowledge Retrieval

- `KnowledgeRetriever` abstraction in `app/knowledge/base.py`
- Current: keyword search over local markdown
- Future: PostgreSQL + pgvector (same interface)

## No-LLM Fallback

When LLM is not configured, chat runs deterministic tools where consent allows and returns educational guidance from the knowledge base.

## Configuration

```env
LLM_API_KEY=
LLM_MODEL=
LLM_BASE_URL=
```
