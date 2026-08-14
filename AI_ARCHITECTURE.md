# FinAI Architecture

## Responsibilities

| Component | Does | Does NOT |
|-----------|------|----------|
| LLM (Groq) | NLU, explanations, English/Hindi/Hinglish | Calculate money |
| Tools | Call deterministic backend | Invent figures |
| Safety | Block credential requests, reckless borrowing | Override tool results |

## LLM Provider

FinAI uses an OpenAI-compatible chat-completions client pointed at Groq:

| Setting | Default |
|---------|---------|
| `LLM_API_KEY` | *(from environment only — never committed)* |
| `LLM_MODEL` | `llama-3.3-70b-versatile` |
| `LLM_BASE_URL` | `https://api.groq.com/openai/v1` |

- All three settings are environment-driven (`app/core/config.py`).
- Changing `LLM_MODEL` to any supported Groq model is sufficient to switch models.
- `LLM_TIMEOUT_SECONDS` / `LLM_READ_TIMEOUT_SECONDS` / `LLM_MAX_RETRIES`
  control request timeouts and transient-failure retries (429/5xx/network).
- The provider never logs or returns the API key, and never exposes provider
  errors to clients (safe `LLM_UNAVAILABLE` application errors instead).
- The frontend never talks to Groq directly; it only calls FastAPI.

## Tools

`calculate_emi`, `calculate_cash_flow`, `calculate_savings_capacity`, `analyze_expenses`, `create_budget`, `calculate_debt_burden`, `calculate_emergency_buffer`, `calculate_credit_readiness`, `simulate_loan`, `get_financial_summary`, `get_user_goals`, `find_government_schemes`, `get_spending_patterns`, `get_cashflow_forecast`, `get_ml_savings_capacity`

## Knowledge Retrieval

- `KnowledgeRetriever` abstraction in `app/knowledge/base.py`
- Current: keyword search over local markdown
- Future: PostgreSQL + pgvector (same interface)

## Financial Data Rule

The LLM is never the source of financial calculations. Personalized flow:

```
User → Auth → Ownership → Consent → Backend calculation → Optional ML
→ Structured result → Groq (explanation only) → Safety validation → Reply
```

- Backend ML outputs (patterns, forecasts, savings ranges, confidence) are
  explained verbatim by the LLM; it never changes the numbers.
- The readiness score is deterministic and backend-computed; the LLM only explains factors.
- Data minimization: only the fields needed for the detected intent are sent.

## No-LLM Fallback

When `LLM_API_KEY` is not configured, chat runs deterministic tools where consent allows and returns educational guidance from the knowledge base (both normal and streaming endpoints).

## Configuration

```env
LLM_API_KEY=
LLM_MODEL=llama-3.3-70b-versatile
LLM_BASE_URL=https://api.groq.com/openai/v1
```
