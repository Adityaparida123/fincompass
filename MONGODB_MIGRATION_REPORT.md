# FinCompass MongoDB Migration Report

Status: COMPLETE (code, tests, tooling, audit) — no commit made (per instruction)
Date: 2026-08-14
Test result: **143/143 passed** (pytest, incl. `ml/tests`)

---

## 1. Objective & Scope
Replace the PostgreSQL/SQLAlchemy/Alembic runtime with MongoDB Atlas behind an
async PyMongo facade, preserving the existing FastAPI API contract, JWT auth,
Redis, Groq/LLM, ML, consent, audit, recycle-bin, and soft-delete behavior.

**Out of scope:** any git commit/push/deploy. The migration tooling keeps the
legacy SQLAlchemy models + Alembic only for one-time data export.

## 2. What Changed
- New async Mongo facade (`app/db/mongo.py`) with a single `MongoDatabase` API
  backed by either `PyMongoBackend` (production) or `MongoMockBackend` (tests).
- `app/db/session.py` now re-exports `get_session`/`get_db` from the facade;
  the whole service + route layer was converted off SQLAlchemy.
- `app/core/config.py`: added `MONGODB_URI`, `MONGODB_DATABASE`,
  `database_backend="mongodb"`; production validator rejects empty/localhost
  URIs and weak JWT secrets (fail-fast startup).
- New `app/db/indexes.py` (idempotent index creation, wired into lifespan).
- New `scripts/migrate_pg_to_mongo.py` (PG → Mongo one-time migration).
- Infra: `render.yaml`, `docker-compose.yml`, `.env.example`,
  `.env.production.example`, `requirements.txt` updated for Mongo.

## 3. Files Added / Rewritten
- Added: `app/db/mongo.py`, `app/db/indexes.py`, `scripts/migrate_pg_to_mongo.py`.
- Rewritten (services): auth (`service`, `refresh_sessions`, `token_flow`,
  `tokens`), finance (`transactions`, `expenses`, `budget`, `context`,
  `savings`), `consent`, `audit`, `recycle_bin`, `notifications`, `readiness`
  (`service`, `factors`), `ml` (`persistence`, `service`), `schemes`
  (`service`, `matcher`).
- Rewritten (AI): `ai/memory.py`, `ai/tools.py`, `ai/agent.py`.
- Converted (routes): all `app/api/routes/*` + `app/api/dependencies.py` +
  `app/main.py` + `health.py`.
- Tests: `tests/conftest.py`, `tests/integration/test_database.py`,
  `tests/unit/test_budget.py` rewritten for the facade.

## 4. Mongo Data Model
Collections: `users, transactions, budgets, savings_goals, debt_obligations,
consents, audit_logs, refresh_token_sessions, ml_predictions,
readiness_scores, readiness_factors, chat_sessions, chat_messages,
notifications, government_schemes, recycle_bin, counters`.

- Every document has both `_id` and numeric `id` (API contract preserved).
- Enums stored as `.value` strings; Pydantic coerces back on `model_validate`.
- `counters` collection (`$inc` + `find_one_and_update` upsert) supplies the
  integer IDs atomically.

## 5. Money & Date Handling
- Money is `Decimal` in Python ↔ `Decimal128` in Mongo.
- **No money arithmetic inside Mongo filters** — amount-range filters and
  aggregation run in Python (`db.sum_field` over a cursor) so results are exact
  and driver-agnostic.
- On decode, `Decimal128 → Decimal` is quantized to 2dp, matching the legacy
  `Numeric(16,2)` serialization contract (e.g. `"6200.00"`).
- Dates stored as ISO-8601 strings; datetimes as native BSON datetimes.

## 6. ID Allocation
`MongoDatabase.next_id()` uses the `counters` collection with upsert. The
migration script pre-seeds `counters.seq` to the max migrated id per collection
so new writes never collide with migrated rows.

## 7. Facade Contract
Public API: `find_one / find / count / insert / insert_many / update_one /
update_many / delete_one / delete_many / find_one_and_update / sum_field /
count_field / ping / create_index / drop_collections`. `commit / flush /
rollback / refresh` are no-ops for SQLAlchemy-session compatibility. Rows
returned as `Doc` (dict subclass with attribute access).

## 8. Testing Strategy & Results
- `tests/conftest.py` sets test env vars **before** any app import (a prior bug
  loaded the repo `.env` Groq key into the settings singleton), then installs a
  fresh `mongomock` DB per test via `set_database` + a dependency override.
- Fixed during the run: conftest import ordering (LLM key leak into tests),
  money scale (`6200` → `6200.00`) via 2dp decode quantize, budget PATCH
  returning pre-update object, and the SQLAlchemy-style `tests/unit/test_budget.py`.
- Result: `143 passed` including auth, chat (LLM/no-LLM, stream, consent,
  session isolation), finance, consent, recycle-bin, ML, and `ml/tests`.

## 9. Lint (ruff)
`ruff check app` after cleanup: 113× B008 (`Depends()` in FastAPI defaults —
standard framework pattern, pre-existing project-wide), 1× E402 (pre-existing
mid-file import in `main.py`), 1× F401 + 1× B904 (both pre-existing). All
newly introduced I001/F401/B007 issues were fixed. New modules
(`app/db/indexes.py`, `scripts/migrate_pg_to_mongo.py`) are clean.

## 10. Deployment & Infrastructure
- `render.yaml`: removed Postgres `finai-db` + `alembic upgrade head`
  preDeploy; added `MONGODB_URI` (secret, `sync: false`) and
  `MONGODB_DATABASE=fincompass`; Redis kept for rate limiting/caching; CORS
  unchanged (`https://fincompass-three.vercel.app`).
- `docker-compose.yml`: `mongo:7` service replaces `postgres:16`; app uses
  `MONGODB_URI=mongodb://mongodb:27017`, DB `fincompass_dev`.
- Env examples document Mongo URI/database and keep `DATABASE_URL` only for
  migration tooling. `.env` remains gitignored.

## 11. Data Migration Tooling
`scripts/migrate_pg_to_mongo.py`: reads every table via the retained SQLAlchemy
models (async engine), converts values (enum→value, date→ISO, money→Decimal,
None dropped), writes docs preserving original `_id`/`id`/timestamps, seeds
`counters`, then runs `ensure_indexes`. Validated: dry-run CLI (16 collections,
0-row source) and a mongomock write-path harness (`MIGRATION_OK`). Full
execution requires a live source PG + target Mongo.

## 12. Security Audit — Secrets
- No hardcoded secrets in `app/` or tracked files. Only flagged match is the
  **placeholder** `MONGODB_URI=mongodb+srv://USER:PASSWORD@CLUSTER...` in
  `.env.production.example` (documented example format, not a real credential).
- `.env` is gitignored; only `.env.example`/`.env.production.example` tracked.
- The local `.env` Groq key is not committed; it is only used for local dev.
  (Recommendation: rotate it before/after staging, since it is a real key.)
- Logger config and exception handlers do not emit request bodies or tokens.

## 13. Security Audit — Authentication & Tokens
- Passwords hashed with Argon2id (`app/services/auth/password.py`); never
  stored/logged in plaintext.
- Refresh tokens: JTI-based rotation, reuse detection, family revocation in
  `refresh_sessions.py`; sessions stored with hashed values + `expires_at`.
- Refresh cookie: `HttpOnly`, `Secure` (prod), `SameSite` configurable
  (`none` in prod for cross-site Vercel↔Render), path-scoped to `/api/v1/auth`.
- Access tokens: short-lived (30 min), `sub` = user id; `get_current_user`
  re-loads the user from Mongo per request.
- `password_hash` never appears in any response schema.

## 14. Security Audit — Authorization & Ownership
- All user-scoped reads/writes filter on `user_id` derived from the
  authenticated token. Verified: transactions, budgets, savings, debt,
  expenses, consents, notifications, chat sessions/messages, recycle bin,
  ML corrections, readiness.
- No IDOR found. Cross-user session access returns 404 (covered by
  `test_chat_session_isolation`). Public reference data (government schemes) is
  intentionally not user-scoped.

## 15. Security Audit — Consent & Privacy
- Sensitive endpoints enforce consent before access
  (`require_consent` → 403 `CONSENT_DENIED`).
- Chat: personal intents require `financial_data_analysis` +
  `chat_financial_context`; the LLM is **never** contacted without consent
  (asserted by tests) and receives only the minimal derived context
  (`finance/context.py`), not raw transactions.
- Audit log: consent grant/revoke, auth events, and sensitive actions are
  recorded with sanitized payloads; audit entries are append-only in
  `audit_logs`.

## 16. Security Audit — Injection & Validation
- NoSQL injection: **0** occurrences of `$regex`/`$where`/user-built operators.
  Mongo filters are constructed server-side from typed fields; user-provided
  values (dates, amounts, category strings) are converted with `_clean_value`
  and never injected as operator keys.
- Amount-range filtering is done in Python over a filtered cursor (money is
  never compared inside Mongo operators).
- Input validation via Pydantic (`ChatRequest` min/max lengths, `BudgetPeriod`
  `^\d{4}-\d{2}$`, password strength, etc.). Failed validation → 422 without
  internal detail disclosure.
- Rate limiting (auth, chat, ML) with fail-closed behavior in production.

## 17. MANUAL VERIFICATION REQUIRED & Next Steps
The suite runs on `mongomock`; the following must be verified against a real
MongoDB/Atlas instance (no local mongod/Docker was available in this
environment):

1. Decimal128 round-trip and `sum_field` accuracy on a real server.
2. `ensure_indexes` execution (incl. unique `users.email`,
   `refresh_token_sessions.refresh_token_hash`, `government_schemes.name`).
3. `scripts/migrate_pg_to_mongo.py` against a live source PG + target Atlas.
4. App boot under `APP_ENV=production` with a real `MONGODB_URI` (fail-fast
   validators must trigger on missing/localhost URIs).
5. Render + docker-compose deploys (mongo healthcheck, env wiring).
6. `pip install -r requirements.txt` from a clean env (new pins:
   `pymongo>=4.10,<5`, `mongomock>=4.3,<5`).
7. Rotate the local `.env` Groq API key before any staging, since it was
   displayed in tool output earlier in this session.

**No commit was made. Changes are staged-ready for review.**
