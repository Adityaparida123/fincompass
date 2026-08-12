# FinAI Backend

Responsible personal-finance platform and AI financial assistant — production-quality MVP backend built with FastAPI, PostgreSQL, and Redis.

FinAI helps users understand cash flow, track expenses, build budgets, simulate loans responsibly, and interact with an explainable FinAI assistant. **Financial calculations are deterministic backend functions**; the LLM explains results and handles conversation — it never invents figures.

---

## Project Overview

| Layer | Responsibility |
|-------|----------------|
| **FinAI (LLM)** | Natural language, tool selection, explanations, Hindi/English support |
| **Financial Engine** | EMI, cash flow, savings, debt, readiness score, loan simulation |
| **PostgreSQL** | Authoritative user and financial data |
| **Redis** | Rate limiting and caching (optional for local dev) |

---

## Tech Stack

- **Python 3.12+**, FastAPI, Uvicorn, Pydantic v2
- **PostgreSQL** + SQLAlchemy 2 async + Alembic + asyncpg
- **Redis** (rate limiting)
- **Argon2id** password hashing, JWT access/refresh tokens, HttpOnly cookies
- **pytest**, httpx, Ruff, Black, MyPy
- **Docker** + Docker Compose

---

## Folder Structure

```
finai-backend/
├── app/
│   ├── main.py              # FastAPI app entry
│   ├── core/                # Config, security, logging, middleware, exceptions
│   ├── api/routes/          # REST endpoints (/api/v1/...)
│   ├── db/models/           # SQLAlchemy models
│   ├── schemas/             # Pydantic request/response models
│   ├── services/            # Business logic (auth, finance, lending, readiness, ...)
│   ├── ai/                  # FinAI agent, tools, prompts, LLM providers
│   ├── knowledge/           # Local knowledge base loader/retriever
│   └── utils/               # Currency, dates, pagination, validation
├── tests/unit/              # Deterministic calculation tests
├── tests/integration/       # API integration tests
├── alembic/                 # Database migrations
├── knowledge_base/          # Markdown reference documents
├── docker-compose.yml
├── Dockerfile
├── requirements.txt
└── .env.example
```

---

## Environment Setup

### 1. Clone and enter the project

```bash
cd finai-backend
```

### 2. Create a virtual environment

```bash
python -m venv .venv

# Windows
.\.venv\Scripts\activate

# macOS/Linux
source .venv/bin/activate
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

### 4. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your values. **Never commit `.env`.**

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL async URL |
| `REDIS_URL` | Redis URL for rate limiting |
| `JWT_SECRET_KEY` | Strong random secret (change in production) |
| `LLM_API_KEY`, `LLM_MODEL`, `LLM_BASE_URL` | OpenAI-compatible LLM (optional; chat works in fallback mode without) |
| `CORS_ORIGINS` | Frontend origin(s), e.g. `http://localhost:3000` |
| `DEFAULT_CURRENCY` | Default `INR` |
| `DEFAULT_TIMEZONE` | Default `Asia/Kolkata` |

---

## Database Setup

### Option A — Docker Compose (recommended)

```bash
docker compose up -d postgres redis
```

### Option B — Local PostgreSQL

Create a database named `finai` and set `DATABASE_URL` in `.env`.

### Run migrations

```bash
alembic upgrade head
```

Create a new migration after model changes:

```bash
alembic revision --autogenerate -m "describe change"
alembic upgrade head
```

---

## Running Locally

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- **API docs:** http://localhost:8000/docs
- **ReDoc:** http://localhost:8000/redoc
- **Health:** http://localhost:8000/health

---

## Running Tests

Tests use an isolated SQLite database — no Postgres/Redis required.

```bash
pytest
pytest -v
pytest tests/unit/
pytest tests/integration/
```

---

## Running with Docker

Full stack (API + Postgres + Redis):

```bash
docker compose up --build
```

API available at http://localhost:8000

---

## API Documentation

All versioned routes live under `/api/v1/`.

### Health

```http
GET /health
```

### Authentication

```http
POST /api/v1/auth/register
POST /api/v1/auth/login
POST /api/v1/auth/refresh
POST /api/v1/auth/logout
POST /api/v1/auth/forgot-password
POST /api/v1/auth/reset-password
GET  /api/v1/auth/me
```

### Example: Register

```bash
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"full_name":"Example User","email":"user@example.com","password":"strong-password-123"}'
```

### Example: Login with Remember Me

```bash
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"strong-password-123","remember_me":true}'
```

### Example: EMI Calculator

```bash
curl -X POST http://localhost:8000/api/v1/tools/emi \
  -H "Content-Type: application/json" \
  -d '{"principal":100000,"annual_interest_rate":12,"tenure_months":12}'
```

### Example: Loan Simulation

```bash
curl -X POST http://localhost:8000/api/v1/tools/loan-simulation \
  -H "Content-Type: application/json" \
  -d '{"income":45000,"monthly_expenses":29800,"existing_debt_payment":5000,"loan_amount":100000,"interest_rate":12,"tenure_months":12}'
```

### Example: FinAI Chat (requires auth + consent)

```bash
curl -X POST http://localhost:8000/api/v1/chat \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{"message":"Can I afford a ₹50,000 loan?"}'
```

---

## Financial Engine

Deterministic services (never LLM-computed):

| Service | Endpoint / Function |
|---------|---------------------|
| Cash flow | `POST /api/v1/cashflow/calculate` |
| Savings capacity | `POST /api/v1/savings/capacity` |
| Emergency fund | `POST /api/v1/savings/emergency-buffer` |
| Expenses | `GET /api/v1/expenses/{weekly\|monthly\|categories\|trends}` |
| Budget | CRUD `/api/v1/budget` |
| Debt burden | `POST /api/v1/debt/burden` |
| EMI | `POST /api/v1/tools/emi` |
| Loan simulation | `POST /api/v1/tools/loan-simulation` |
| Credit readiness | `GET /api/v1/credit-readiness`, `POST /api/v1/credit-readiness/correct` |
| Recommendations | `GET /api/v1/recommendations` |
| Government schemes | `GET /api/v1/schemes`, `POST /api/v1/schemes/match` |

Monetary values use Python `Decimal` for precision.

---

## FinAI Architecture

```
User Question → Intent Router → Context Retrieval → Tool Selection
    → Deterministic Financial Tool → Result → LLM Explanation → Safety Validation → Response
```

- **Tools:** EMI, cash flow, savings, expenses, budget, debt, emergency buffer, credit readiness, loan simulation, schemes, financial summary
- **Languages:** English and Hindi (including code-switching)
- **Fallback:** When no LLM is configured, chat returns structured tool-based responses

Configure LLM via `LLM_API_KEY`, `LLM_MODEL`, `LLM_BASE_URL` (OpenAI-compatible).

---

## Security & Privacy

- Argon2id password hashing — **plaintext passwords are never stored**
- JWT access tokens + HttpOnly refresh cookies with rotation
- CORS, input validation, SQL injection protection via ORM
- Redis rate limiting on `/auth/*` and `/chat/*`
- Request IDs on every response
- Audit logs for sensitive actions (no secrets logged)
- Consent required for personalized financial analysis

### Consent types

- `financial_data_analysis`
- `personalized_recommendations`
- `chat_financial_context`

---

## Deployment Notes

1. Set `APP_ENV=production`, `DEBUG=false`, strong `JWT_SECRET_KEY`
2. Set `COOKIE_SECURE=true` (HTTPS)
3. Run `alembic upgrade head` before starting the API
4. Configure `CORS_ORIGINS` for your Next.js frontend domain
5. Provide LLM credentials for full conversational FinAI

---

## Future Frontend Integration

The backend is API-first and ready for a Next.js frontend:

1. Point frontend API base URL to `http://localhost:8000/api/v1`
2. Use `Authorization: Bearer <access_token>` for authenticated routes
3. Enable `credentials: 'include'` for refresh cookie flows
4. Request consent before showing personalized dashboards
5. Use `/docs` OpenAPI spec for client code generation

---

## Known Limitations

- No external bank/UPI aggregation yet (manual transactions supported)
- Knowledge retrieval is keyword-based (pgvector planned)
- Password reset uses token flow without email delivery (MVP stub)
- Budget/debt/savings restore from recycle bin not yet implemented (transactions supported)
- LLM streaming requires configured provider

---

## License

Private / project use — adjust as needed for your organization.
