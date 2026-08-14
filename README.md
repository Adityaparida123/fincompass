# FinCompass

Unified monorepo for a responsible personal-finance platform — **backend API**, **Next.js frontend**, and **ML analytics layer**.

FinCompass helps users understand cash flow, track expenses, build budgets, simulate loans responsibly, and interact with an explainable FinAI assistant. **Financial calculations are deterministic backend functions**; ML provides probabilistic insights; the LLM explains results and handles conversation.

---

## Monorepo Structure

```
fincompass/
├── app/                 # FastAPI backend (API, auth, financial engine, FinAI)
├── frontend/            # Next.js 16 web app (i18n, dashboard, chat)
├── ml/                  # Machine learning layer (classifier, anomaly, forecast)
├── alembic/             # Database migrations
├── knowledge_base/      # FinAI reference documents
├── tests/               # Backend integration & unit tests
├── docker-compose.yml   # Local Postgres + Redis + API
├── Dockerfile           # Production API container (Render)
└── render.yaml          # Render Blueprint (backend deploy)
```

| Component | Stack | Deploy target |
|-----------|-------|---------------|
| **Backend** (`app/`) | FastAPI, PostgreSQL, Redis, JWT | [Render](render.yaml) |
| **Frontend** (`frontend/`) | Next.js 16, React 19, Tailwind | Vercel (root: `frontend/`) |
| **ML** (`ml/`) | scikit-learn, SHAP, MLflow | Bundled with backend API |

---

## Architecture

| Layer | Location | Responsibility |
|-------|----------|----------------|
| **Frontend** | `frontend/` | UI, auth flows, dashboards, FinAI chat |
| **Financial Engine** | `app/services/finance/` | EMI, cash flow, savings, debt, loan simulation |
| **ML Layer** | `ml/` | Transaction categorization, anomaly detection, forecasting |
| **FinAI (LLM)** | `app/ai/` | Natural language, tool selection, Hindi/English |
| **PostgreSQL** | managed | Authoritative user and financial data |
| **Redis** | managed | Rate limiting |

---

## Tech Stack

**Backend**
- Python 3.12+, FastAPI, Uvicorn, Pydantic v2
- PostgreSQL + SQLAlchemy 2 async + Alembic + asyncpg
- Redis (rate limiting), Argon2id, JWT

**Frontend**
- Next.js 16, React 19, TypeScript, Tailwind CSS 4
- next-intl (English/Hindi), TanStack Query, Zustand

**ML**
- scikit-learn, SHAP, MLflow, pandas, joblib

---

## Quick Start

### Backend

```bash
cd fincompass
python -m venv .venv
.\.venv\Scripts\activate          # Windows
pip install -r requirements.txt
cp .env.example .env
docker compose up -d postgres redis
alembic upgrade head
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

API docs: http://localhost:8000/docs

### Frontend

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

App: http://localhost:3000

### ML

```bash
pip install -r ml/requirements.txt
python -m ml.pipelines.training_pipeline
python -m ml.demo.run_demo
pytest ml/tests/ -v
```

See `ml/README.md` for full ML documentation.

---

## Folder Structure (Backend)

```
app/
├── main.py              # FastAPI app entry
├── core/                # Config, security, logging, middleware
├── api/routes/          # REST endpoints (/api/v1/...)
├── db/models/           # SQLAlchemy models
├── schemas/             # Pydantic request/response models
├── services/            # Business logic (auth, finance, ml, ...)
├── ai/                  # FinAI agent, tools, prompts
└── utils/               # Currency, dates, pagination
```

---

## Environment Setup (Backend)

### 1. Clone and enter the project

```bash
git clone https://github.com/Adityaparida123/fincompass.git
cd fincompass
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
| `LLM_API_KEY`, `LLM_MODEL`, `LLM_BASE_URL` | LLM provider — Groq by default (`llama-3.3-70b-versatile`). Optional; chat works in fallback mode without a key |
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

- **Tools:** EMI, cash flow, savings, expenses, budget, debt, emergency buffer, credit readiness, loan simulation, schemes, financial summary, ML spending patterns, cash-flow forecast, ML savings capacity
- **Languages:** English, Hindi, and Hinglish (including code-switching)
- **Fallback:** When no LLM is configured, chat returns structured tool-based responses
- **LLM provider:** Groq via the OpenAI-compatible client (no extra SDK needed)

Configure the LLM via environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `LLM_API_KEY` | Groq API key (local `.env` only, never committed) | *(none)* |
| `LLM_MODEL` | Groq model name | `llama-3.3-70b-versatile` |
| `LLM_BASE_URL` | OpenAI-compatible endpoint | `https://api.groq.com/openai/v1` |

Switch models by changing `LLM_MODEL` only. Timeouts and retries are controlled by
`LLM_TIMEOUT_SECONDS`, `LLM_READ_TIMEOUT_SECONDS`, and `LLM_MAX_RETRIES`.

The frontend never contacts Groq directly — it only calls FastAPI, which keeps
the API key server-side. Personalized answers use backend-computed numbers
(expenses, savings, readiness, ML outputs); the LLM explains them but never
recalculates or invents figures.

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
