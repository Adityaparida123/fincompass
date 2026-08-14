# Security

## Authentication

- **Argon2id** password hashing (64 MiB, t=3, p=4) — plaintext never stored or logged
- **JWT HS256** access tokens (30 min, `jti` per token) + refresh tokens (30/90 days, HttpOnly cookies)
- **Refresh token sessions** collection tracks JTIs; reuse detection revokes the token family
- **Logout** revokes refresh JTI; **reset password** revokes all sessions
- Production refuses to start with a weak/missing `JWT_SECRET_KEY` (>= 32 random chars enforced)

## Transport & Cookies

- Refresh cookies are `HttpOnly`; `Secure` in production; `SameSite=None` in production
  (cross-site Vercel frontend ↔ Render backend) — see `app/core/config.py: cookie_samesite`
- `SameSite=Lax` only for local development
- CORS restricted to configured origins (`CORS_ORIGINS`); credentialed requests to a
  single verified origin in production

## Data Storage (MongoDB)

- Runtime persistence is MongoDB via an async PyMongo facade (`app/db/mongo.py`)
- Money stored as BSON `Decimal128`, always decoded to 2-dp `Decimal` on read
- Every user-scoped query filters by `user_id` (no cross-user reads/writes)
- Indexes (including unique email and refresh-token hash) are created idempotently at startup

## Startup & Health

- In production the app **fails fast** if MongoDB is unreachable at startup
  (`app/main.py`) — a running deployment never masquerades as healthy without its DB
- `/health` reports `degraded` unless MongoDB (and Redis in production) is reachable
- Health/error responses never expose connection strings, stack traces, or internal paths

## Rate Limiting

- Redis-backed limits on `/api/v1/auth/*`, `/api/v1/chat/*`, and `/api/v1/ml/*`
- Fail-closed in production: if Redis is unavailable, requests are rejected rather than unlimited
- Disabled via `RATE_LIMIT_ENABLED=false` for local dev without Redis

## Privacy

- Consent required for personalized financial endpoints; revocations enforced on read paths
- FinAI receives **minimal context** per intent (`FinancialContextService`)
- Audit logs never store passwords, tokens, API keys, or raw financial values
- LLM (Groq) API key is read from the environment server-side only; never sent to the browser
  or written to logs

## Errors

Production responses never expose stack traces, SQL, connection URIs, or internal paths.
