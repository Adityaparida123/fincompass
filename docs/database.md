# FinCompass Database Architecture

FinCompass uses **PostgreSQL** as the authoritative production database and **SQLite** for lightweight local development. **Redis** stores non-authoritative cache and rate-limit counters.

## Architecture

```
Next.js Frontend
       │
       ▼
   FastAPI API
       │
   ┌───┴───┐
   ▼       ▼
PostgreSQL  Redis
(source     (cache,
 of truth)   rate limits)
```

## Drivers

| Environment | URL example | Driver |
|-------------|-------------|--------|
| Local dev | `sqlite+aiosqlite:///./finai_dev.sqlite` | aiosqlite |
| Docker / production | `postgresql+asyncpg://user:pass@host:5432/finai` | asyncpg |

Configuration is centralized in `app/core/config.py` via Pydantic Settings.

## Tables

| Table | Purpose |
|-------|---------|
| `users` | Accounts and profile defaults |
| `consents` | Data-use consent records |
| `transactions` | Income/expense ledger (soft delete via `is_deleted`) |
| `budgets` | Monthly category limits |
| `savings_goals` | Savings targets |
| `debt_obligations` | Debt tracking |
| `readiness_scores` | Credit readiness history |
| `readiness_factors` | Explainability factors per score |
| `chat_sessions` / `chat_messages` | FinAI chat history |
| `notifications` | In-app notifications |
| `government_schemes` | Reference scheme catalog |
| `audit_logs` | Sensitive action audit trail |
| `recycle_bin` | Soft-deleted resource snapshots |
| `refresh_token_sessions` | Rotating refresh token sessions |
| `ml_predictions` | Persisted ML outputs |

### Financial data rules

- Monetary columns use `NUMERIC(16, 2)` — never `FLOAT`
- Timestamps use `DateTime(timezone=True)`
- All user-owned rows include `user_id` with FK + cascade/index
- Soft delete: `transactions.is_deleted` + `recycle_bin`

### Consent types

- `financial_data_analysis`
- `personalized_recommendations`
- `chat_financial_context`
- `ml_analysis`

## Indexes

Key indexes (see migration `0004_postgresql_enhancements`):

- `transactions(user_id, date)`
- `notifications(user_id, is_read)`
- `readiness_scores(user_id, created_at)`
- `ml_predictions(user_id, prediction_type)`

## Redis usage

Redis is **not** the source of truth for financial records.

| Use | Key pattern |
|-----|-------------|
| Rate limiting | `rl:{scope}:{ip}` |
| Dashboard cache | `cache:user:{id}:user_dashboard` |
| Cashflow cache | `cache:user:{id}:user_cashflow` |

Cache invalidation runs after transaction create/update/delete via `app/core/cache.py`.

## Local development (SQLite)

```bash
cp .env.example .env
python scripts/bootstrap_sqlite_dev.py
uvicorn app.main:app --reload
```

Or use Docker Postgres:

```bash
docker compose up -d postgres redis
# set DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/finai
alembic upgrade head
```

## Production (PostgreSQL)

```bash
alembic upgrade head
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Render runs `alembic upgrade head` automatically via `render.yaml`.

## Migrations

Create:

```bash
alembic revision --autogenerate -m "describe change"
```

Apply:

```bash
alembic upgrade head
```

Rollback one step:

```bash
alembic downgrade -1
```

Current revision:

```bash
alembic current
```

### SQLite vs PostgreSQL migrations

- Alembic migrations are authored for **PostgreSQL** (native ENUM types, JSONB)
- SQLite local bootstrap uses `scripts/bootstrap_sqlite_dev.py` (`create_all`)
- Enum values added in PostgreSQL use `ALTER TYPE ... ADD VALUE`

## SQLite → PostgreSQL data migration

1. Create PostgreSQL schema: `alembic upgrade head`
2. Export/import data:

```bash
export DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/finai
python scripts/migrate_sqlite_to_postgres.py --sqlite-url sqlite+aiosqlite:///./finai_dev.sqlite
```

3. Verify record counts in the script report
4. Keep the SQLite file as backup — the script does not delete it

Dry run:

```bash
python scripts/migrate_sqlite_to_postgres.py --dry-run
```

## Backups (PostgreSQL)

### Hackathon / small deployment

Daily logical backup:

```bash
pg_dump "$DATABASE_URL" -Fc -f fincompass_$(date +%Y%m%d).dump
```

Restore:

```bash
pg_restore -d finai --clean --if-exists fincompass_YYYYMMDD.dump
```

### Recommended policy

| Setting | Recommendation |
|---------|----------------|
| Frequency | Daily (production), before each deploy (hackathon) |
| Retention | 7 days minimum |
| Storage | Encrypted object storage or Render backups |
| Test restores | Monthly |

## Health check

`GET /health` returns:

```json
{
  "status": "healthy",
  "database": {"backend": "postgresql", "status": "connected"},
  "redis": {"status": "connected"}
}
```

## Security

- Never commit `.env` or production credentials
- Use strong `JWT_SECRET_KEY` in production (not `change-me`)
- Set `COOKIE_SECURE=true` with HTTPS
- Restrict PostgreSQL network access
- Use least-privilege DB user
- CORS must list explicit frontend origins (never `*` with credentials)

## Testing

Integration tests use isolated SQLite via `tests/conftest.py`.

Run:

```bash
pytest tests/integration/test_database.py -v
pytest
```

Do not run destructive tests against production databases.
