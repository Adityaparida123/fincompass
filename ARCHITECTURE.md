# Architecture

## Layers

```
Next.js Frontend (future)
        │
        ▼
FastAPI API (/api/v1)
        │
   ┌────┴────┬────────────┬──────────────┐
   ▼         ▼            ▼              ▼
 Services   FinAI       PostgreSQL      Redis
 (finance)  (LLM+tools)  (data)        (rate limit)
```

## FinAI Flow

```
User message → Intent router → Consent check → Minimal context
→ Tool selection → Deterministic engine → LLM explanation → Safety validation
```

## Key Modules

| Path | Role |
|------|------|
| `app/api/routes/` | HTTP endpoints |
| `app/services/finance/` | Deterministic calculations |
| `app/services/readiness/` | Explainable credit readiness |
| `app/ai/` | Chat agent, tools, safety |
| `app/services/consent/` | Consent enforcement |
| `app/services/auth/` | Auth + refresh sessions |
| `app/knowledge/` | Local knowledge retrieval |

## Data

- Timestamps stored in UTC
- User-facing dates converted via `app/utils/dates.py` (Asia/Kolkata default)
