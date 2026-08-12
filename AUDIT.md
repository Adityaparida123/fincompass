# FinAI Backend Audit (Phase 0)

**Date:** 2026-08-12  
**Baseline:** 82 tests passing before hardening; Ruff 152 issues; MyPy 22 issues in 13 files.

## Current Status (Post-Hardening Pass)

| Area | Before | After |
|------|--------|-------|
| Tests | 82 passing | **86 passing** (+ fairness tests) |
| Auth rate limiting | Imported but unwired | Wired on all `/auth/*` routes |
| Refresh token revocation | Cookie-only logout | DB-backed JTI sessions + reuse detection |
| Transaction consent | Missing | Enforced |
| Recycle bin | Transactions only | Budget, debt, savings restore |
| FinAI context | Full profile sent | Intent-based minimal context |
| Knowledge retrieval | Built, unused | Wired into chat + fallback |
| Email reset | Token only | `EmailService` + console provider |
| Expense analytics | Basic totals | Comparison, recurring, insights |
| Notifications | Read-only API | `POST /notifications` create |
| Observability | Request ID only | Request ID + latency logging |

## Bugs Found & Fixed

1. Missing `await` on `compute_and_store()` in readiness service
2. Async SQLAlchemy lazy-load on recycle bin snapshot after flush
3. `timedelta` import removed accidentally from `tokens.py`
4. Logout `Response = None` default type error
5. Chat fallback tests outdated after improved no-LLM behavior

## Security Issues Addressed

- Refresh token rotation with JTI tracking and reuse detection (`refresh_token_sessions`)
- Password reset emails via pluggable provider (no token returned to API in production path)
- Auth endpoints rate-limited (Redis, fail-open in dev)
- Consent enforced on transaction CRUD
- Minimal financial context to LLM (privacy + cost)

## Remaining Gaps

- Docker not verified on this machine (Docker CLI unavailable)
- Full LLM conversational quality requires `LLM_API_KEY` configuration
- pgvector semantic search not implemented (architecture prepared)
- SMTP provider requires env configuration
- CSRF tokens not added (SameSite=Lax cookies + CORS used)
- Some MyPy/Ruff warnings remain in legacy modules

## Recommended Next Steps

1. Run `docker compose up --build` on a machine with Docker
2. `alembic upgrade head` against PostgreSQL
3. Configure LLM credentials for production FinAI
4. Connect Next.js frontend with consent UI
