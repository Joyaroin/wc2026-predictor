# Logical Components — Unit `backend`

Maps the NFR patterns to concrete modules (paths under `api/src/`).

## Entry points
- `app.ts` — builds the Express app (middleware + routes); `app.listen` for local dev.
- `lambda.ts` — wraps `app` with `@codegenie/serverless-express` for API Gateway.
- `sync.lambda.ts` — handler invoked by EventBridge schedule / manual trigger → `syncService.sync()`.

## Middleware (`src/middleware/`)
| Module | Responsibility | Rule |
|---|---|---|
| `securityHeaders.ts` | helmet config (CSP, HSTS, etc.) | SECURITY-04 |
| `cors.ts` | cors allowlist (origin from config) | SECURITY-08 |
| `requestContext.ts` | assign request id; base logger child | SECURITY-03 |
| `rateLimit.ts` | global limiter + strict `loginLimiter`, `joinLimiter` | SECURITY-11 |
| `auth.ts` | `requireSession` → `req.callerId` | SECURITY-08/12 |
| `validate.ts` | `validateBody(schema)` using zod | SECURITY-05 |
| `errorHandler.ts` | typed-error → HTTP mapping; generic bodies | SECURITY-09/15 |

## Services (`src/services/`)
| Module | Responsibility |
|---|---|
| `authService.ts` | login-or-signup, PIN hash/verify, token issue |
| `playerService.ts` | profile, rename |
| `groupService.ts` | create/join, invite codes, `assertMember` |
| `matchService.ts` | list/get matches, `isLocked(now)` |
| `predictionService.ts` | upsert (lock+ownership), visibility |
| `leaderboardService.ts` | aggregate + `compareStandings` (shared) |
| `scoringService.ts` | precompute/persist points on result |
| `syncService.ts` | orchestrate fetch→map→persist→rescore |

## Integration (`src/integration/`)
- `footballApiClient.ts` — `fetch` with timeout + retry/backoff; maps provider → domain `Match`; token from config.

## Repositories (`src/repos/`)
- `dynamo.ts` — DocumentClient singleton (endpoint override for local).
- `mappers.ts` — pure `toItem`/`fromItem` for each entity (PBT-02 round-trip targets).
- `playerRepo.ts`, `groupRepo.ts`, `membershipRepo.ts`, `matchRepo.ts`, `predictionRepo.ts` — single-table access (keys per backend domain-entities.md).

## Cross-cutting (`src/lib/`)
| Module | Responsibility | Rule |
|---|---|---|
| `config.ts` | load + validate env; fail fast | SECURITY-12 / US-7.2 |
| `logger.ts` | structured JSON logger + redaction | SECURITY-03 |
| `token.ts` | HMAC sign/verify session token | SECURITY-12 |
| `pin.ts` | scrypt hash/verify (timing-safe) | SECURITY-12 |
| `ids.ts` | `randomUUID`, invite-code generator (CSPRNG) | SECURITY-11 |
| `errors.ts` | typed error classes | SECURITY-15 |
| `clock.ts` | `now()` indirection (server-authoritative lock; testable) | LR-1 |

## Logical infra elements (no queues/caches needed at this scale)
- No message queue, no Redis cache — small scale + precomputed points make them unnecessary (KISS). DynamoDB on-demand + Lambda concurrency suffice.
- Scheduled trigger (EventBridge) and Secrets Manager are realized in `infra` (Infrastructure Design).
