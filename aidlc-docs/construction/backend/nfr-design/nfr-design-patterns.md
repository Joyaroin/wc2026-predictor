# NFR Design Patterns — Unit `backend`

## Security middleware pipeline (order matters)
```
1. helmet()                         # security headers (SECURITY-04)
2. cors({ origin: allowedOrigin })  # strict allowlist, credentials off (SECURITY-08)
3. requestId + logger               # correlation id; structured logs, redaction (SECURITY-03)
4. express.json({ limit: '16kb' })  # body size limit (SECURITY-05)
5. rateLimiters                     # global + stricter on /auth/login, /groups/join (SECURITY-11)
6. route handlers                   # validate (zod) -> requireSession (authz) -> service
7. notFound handler                 # generic 404
8. errorHandler                     # maps typed errors -> status + generic body (SECURITY-09/15)
```

## Authentication & authorization patterns (SECURITY-08/12)
- **PIN hashing**: `scrypt(pin, salt)` → store `salt:dkHex`; verify with constant-time compare (`crypto.timingSafeEqual`).
- **Session token**: HMAC-SHA256 over `base64url({sub,iat,exp})`; `verify` checks signature (timing-safe) + `exp`. Stateless → scales with Lambda.
- **requireSession** middleware: extract `Authorization: Bearer <token>`, verify → `req.callerId`; on failure 401 (fail closed).
- **Object-level authz**: `PredictionRepo` keyed by `callerId`; `assertMember(callerId, groupId)` before any group-scoped read (prevents IDOR).

## Resilience patterns (sync / external provider) — SECURITY-15, NFR-5.1
- **Timeout**: each provider HTTP call uses an `AbortController` timeout (e.g., 8s).
- **Retry with backoff**: up to 3 attempts on transient errors (429/5xx/network) with exponential backoff + jitter; respect `Retry-After` if present.
- **Fail-soft**: on exhausted retries, abort the sync run, keep last-known data, log error, return `SyncReport{ ok:false, errors }`. Reads remain available.
- **Idempotent sync**: writing the same provider snapshot twice yields identical stored state (PBT-04 advisory). Scoring re-run is deterministic.

## Performance patterns
- **Precomputed points** (write-time) → cheap O(members) leaderboard reads.
- **Warm-client reuse**: DynamoDB DocumentClient and config are module-level singletons reused across warm Lambda invocations (avoids per-request setup).
- **Schedule-based polling**: provider fetched every 10 min (not per request) — bounded external cost.

## Reliability / error handling (SECURITY-15)
- Typed error classes (`ValidationError`, `AuthError`, `ForbiddenError`, `NotFoundError`, `ConflictError`, `LockedError`, `RateLimitError`) → single `errorHandler` mapping to status + generic JSON.
- All `await`ed external/DB calls wrapped; unhandled rejections caught by the global handler; **writes fail closed**.

## Observability (SECURITY-03/14 — app side)
- Structured JSON logs to stdout: `{ ts, level, requestId, msg, ...fields }`; **redact** `pin`, `pinHash`, tokens, API key.
- Log security-relevant events: login failures, authz denials, rate-limit hits (for SECURITY-14 alerting wired in `infra`).

## Configuration / secrets (SECURITY-12)
- `loadConfig()` validates required env at cold start; **fail fast** with a clear message if missing (US-7.2). Secrets (signing key, API token) injected by `infra` from Secrets Manager — never in source.
