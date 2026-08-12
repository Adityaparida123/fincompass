# Security

## Authentication

- **Argon2id** password hashing — plaintext never stored or logged
- **JWT** access tokens (short-lived) + refresh tokens (HttpOnly cookies)
- **Refresh token sessions** table tracks JTIs; reuse detection revokes token family
- **Logout** revokes refresh JTI; **reset password** revokes all sessions

## Transport & Cookies

- `HttpOnly`, `Secure` (production), `SameSite=Lax` refresh cookies
- CORS restricted to configured origins

## Rate Limiting

- Redis-backed limits on `/api/v1/auth/*` and `/api/v1/chat/*`
- Disabled via `RATE_LIMIT_ENABLED=false` for local dev without Redis

## Privacy

- Consent required for personalized financial endpoints
- FinAI receives **minimal context** per intent (`FinancialContextService`)
- Audit logs never store passwords, tokens, or OTPs

## Errors

Production responses never expose stack traces, SQL, or internal paths.
