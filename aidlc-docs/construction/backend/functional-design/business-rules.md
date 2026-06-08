# Business Rules — Unit `backend`

## AR — Authentication & identity (SECURITY-12)
- **AR-1** Login input: `name` (1..30) + `pin` (exactly 4 digits `^\d{4}$`).
- **AR-2** Resolve player by `nameKey = lower(trim(name))`:
  - If no player: **create** one with that name + scrypt(pin) hash, return session token (sign-up).
  - If player exists: verify `pin` against `pinHash`; on success return session token; on failure increment `failedLogins`, return generic `401 invalid name or PIN`.
- **AR-3** PIN stored only as `scrypt` salted hash (`salt:derivedKeyHex`); PIN is never stored in plaintext, never logged, never returned.
- **AR-4** Brute-force control (CQ3=B, minimal): the `/auth/login` route is **rate-limited** (e.g., per-IP and per-nameKey throttling). No hard multi-hour lockout required for this casual 4-digit game; throttling/backoff is the control.
- **AR-5** Session token: HMAC-SHA256 signed `{sub: playerId, iat, exp}`, TTL 30 days, signing key from config secret. Validated (signature + expiry) on every authenticated request → yields `callerId`.
- **AR-6** Name uniqueness enforced atomically on create (conditional put on `NAME#<nameKey>`); race → `409 name taken`.
- **AR-7** Rename: caller may change their own display name to another **free** name (re-checks uniqueness); PIN unchanged.

## OR — Ownership & access control (SECURITY-08)
- **OR-1** Every authenticated route resolves `callerId` from the session token (never trust a client-supplied id).
- **OR-2** Predictions are keyed by `callerId`; a caller can only create/read/update **their own** predictions (ownership = token subject).
- **OR-3** Group-scoped reads (leaderboard, members, match predictions) require `callerId` ∈ group members (`assertMember`), else `403/404`.
- **OR-4** No admin/privileged HTTP routes are publicly exposed; sync runs as an internal scheduled job.

## LR — Prediction lock (server-authoritative)
- **LR-1** A match is **locked** when `serverNow >= kickoff`. The server clock is authoritative; client clocks are ignored.
- **LR-2** Create/update of a prediction for a locked match → `409 LockedError` (fail closed).
- **LR-3** Score input validated by `shared` `predictionInputSchema` (goals 0..30) before persistence (SECURITY-05).

## VR — Visibility (fair play, US-6.1)
- **VR-1** For an **unlocked** match, `GET match predictions` returns only the caller's own prediction.
- **VR-2** For a **locked/finished** match, it returns all group members' predictions (+ actual score + points).

## GR — Groups
- **GR-1** Invite code: 8 chars from alphabet `A-Z2-9` (no 0/O/1/I), generated with a CSPRNG; uniqueness ensured by conditional put (regenerate on collision).
- **GR-2** Join is idempotent: re-joining returns the group without duplicate membership.
- **GR-3** Joining an unknown code → `404`.

## SR — Sync & scoring (US-3.4, US-5.2)
- **SR-1** Provider: **football-data.org**, competition `WC`; API key (token header) read from config secret; never logged (SECURITY-12).
- **SR-2** Cadence: scheduled **every 10 minutes**; plus an internal manual trigger (not publicly routed).
- **SR-3** Map provider matches → domain `Match`: derive `stage`, `groupName`, `placeholder` (true when a team is a placeholder like "Winner Group A"), `kickoff` (UTC), `status`, full-time `homeScore/awayScore`.
- **SR-4** On a match transitioning to FINISHED (or a corrected final score): for each prediction of that match, set `points = computePoints(pred, actual)` via `shared`; persist. Corrections re-run scoring (auditable — SECURITY-13).
- **SR-5** Provider failure: keep last-known data, log the error, return a `SyncReport` with the failure; never crash (NFR-5.1, SECURITY-15).
- **SR-6** Respect provider rate limits: interval-based fetch only (not per user request).

## ER — Error taxonomy → HTTP
| Error | HTTP | Body (generic) |
|---|---|---|
| ValidationError | 400 | `{ error: "Invalid request" }` |
| AuthError (bad/missing token, bad PIN) | 401 | `{ error: "Unauthorized" }` |
| ForbiddenError (not a member) | 403 | `{ error: "Forbidden" }` |
| NotFoundError | 404 | `{ error: "Not found" }` |
| ConflictError (name taken) | 409 | `{ error: "Conflict" }` |
| LockedError | 409 | `{ error: "Match locked" }` |
| RateLimited | 429 | `{ error: "Too many requests" }` |
| (unexpected) | 500 | `{ error: "Internal error" }` (no stack/internal details — SECURITY-09) |

All error paths fail closed and never bypass auth/validation (SECURITY-15).
