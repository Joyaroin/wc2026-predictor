# Code Summary — Unit `backend`

## Verification (executed)
- `tsc --noEmit`: clean
- `vitest`: **26/26 pass** (8 files)
- `npm audit`: **0 vulnerabilities**

## REST endpoints (all under `/api`, JSON)
`POST /auth/login` · `GET /players/me` · `POST /players/me/name` · `POST /groups` · `POST /groups/join` · `GET /groups` · `GET /groups/:id` · `GET /groups/:id/members` · `GET /groups/:id/leaderboard` · `GET /groups/:id/players/:pid/breakdown` · `GET /groups/:id/matches/:mid/predictions` · `GET /matches` · `GET /predictions/me` · `PUT /predictions/:matchId` · plus `GET /health`.

## Files created (api/)
- **lib/**: config, logger (redaction), errors, ids, clock, pin (scrypt), token (HMAC).
- **repos/**: types (interfaces), mappers (pure, PBT-02), dynamo (single-table), memory (tests/`PERSISTENCE=memory`).
- **integration/**: footballApiClient (timeout+retry, `mapToDomain`).
- **services/**: auth, players, groups, matches, predictions, scoring, leaderboard, sync, container, dtos.
- **middleware/**: requestContext, requireSession, validateBody, rate limiters, notFound, errorHandler.
- **routes/index.ts**, **server.ts** (app + pipeline), **bootstrap.ts** (composition), **app.ts** (local), **lambda.ts**, **sync.lambda.ts**.
- **scripts/create-table.ts**, **docker-compose.yml**, **.env.example**, **README.md**.

## Tests (api/test/)
- `lib/pin.test.ts`, `lib/token.test.ts` (PBT round-trip + tamper/expiry)
- `repos/mappers.pbt.test.ts` (PBT-02 round-trips for all 4 entities)
- `services/scoring.test.ts` (persists computePoints)
- `integration/auth.flow.test.ts`, `predict.flow.test.ts` (lock + validation), `leaderboard.flow.test.ts` (ranking + member authz), `footballApiClient.test.ts` (mapping, missing-token error, fetch)

## Story traceability
US-1.x (auth/identity), US-2.x (groups/invite/authz), US-3.x (fixtures/sync/placeholders), US-4.x (predict/lock/validate/ownership), US-5.x (scoring/leaderboard/tie-break), US-6.x (visibility), US-7.x (secrets/headers/CORS/rate-limit/safe-errors) — implemented.

## Security / PBT
- 🔒 SECURITY-03 (logging+redaction), 04 (helmet), 05 (zod + body limit), 08 (CORS allowlist + membership/ownership), 09 (generic errors), 11 (rate limit + isolated modules), 12 (scrypt PIN + signed token + secrets from config), 13 (deterministic rescore), 15 (global handler + fail-closed). Infra-tier rules (01/02/06/07/14) deferred to `infra`.
- 🧪 PBT-02 mapper + token round-trips; example/unit tests for scoring, lock, authz. `npm audit` clean (SECURITY-10).

## Notes / accepted trade-offs
- A 1-goal-margin home-win prediction vs a different 1-goal-margin home win scores **3** (correct goal difference), not 2 — confirmed by tests (consistent with shared BR-1.8).
- Full DynamoDB integration requires Docker (DynamoDB Local); service/flow tests use in-memory repositories.
