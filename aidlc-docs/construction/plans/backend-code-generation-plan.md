# Code Generation Plan — Unit `backend`

**Workspace root**: `/Users/adhamsedik/match_worldcup_predictor`. **Unit dir**: `api/`. **Position**: 2nd (after `shared`).
**Depends on**: `@wc2026/shared`. **Stories**: US-1.x, US-2.x, US-3.x, US-4.x, US-5.x, US-6.x, US-7.x (server side).
This plan is the single source of truth for `backend` code generation. Code → `api/` (never aidlc-docs/). Doc summaries → `aidlc-docs/construction/backend/code/`.

---

## Steps

### Step 1 — Package scaffold [x]
`api/package.json` (pinned deps per tech-stack-decisions.md), `api/tsconfig.json`, `api/vitest.config.ts`, `api/.env.example`, `api/docker-compose.yml` (DynamoDB Local), `api/scripts/create-table.ts`. Add `api` to root workspaces.

### Step 2 — lib/ cross-cutting [x]
`config.ts` (load+validate env, fail fast), `logger.ts` (JSON + redaction), `errors.ts` (typed errors), `ids.ts` (uuid + invite code CSPRNG), `clock.ts` (now()), `pin.ts` (scrypt hash/verify timing-safe), `token.ts` (HMAC session sign/verify). — SECURITY-03/09/11/12/15

### Step 3 — Repository layer [x]
`repos/dynamo.ts` (DocumentClient singleton + endpoint override), `repos/mappers.ts` (pure toItem/fromItem), `repos/{player,group,membership,match,prediction}Repo.ts` (single-table keys + GSIs). Repos behind interfaces to allow test doubles.

### Step 4 — Integration layer [x]
`integration/footballApiClient.ts` (fetch + timeout + retry/backoff; map football-data.org → domain `Match`; stage/group/placeholder derivation; token from config). — SR-1/SR-3, resilience.

### Step 5 — Services [x]
`services/{auth,player,group,match,prediction,scoring,leaderboard,sync}Service.ts` implementing AR/OR/LR/VR/GR/SR business rules using repos + `@wc2026/shared`.

### Step 6 — Middleware [x]
`middleware/{securityHeaders,cors,requestContext,rateLimit,auth,validate,errorHandler}.ts`. — SECURITY-03/04/05/08/09/11/15

### Step 7 — Routes + app + handlers [x]
`routes/*.ts` (controllers per REST surface), `app.ts` (pipeline+routes, `app.listen` local), `lambda.ts` (serverless-express), `sync.lambda.ts` (scheduled handler).

### Step 8 — Tests [x]
- Unit/PBT (no Docker): `mappers.pbt.test.ts` (PBT-02 item⇄domain), `token.test.ts` (sign/verify + tamper), `pin.test.ts` (hash/verify), `scoringService.test.ts` (persists computePoints), `footballApiClient.test.ts` (mapping + retry, mocked fetch), `predictionService.test.ts` (lock + ownership via fake repos), `leaderboardService.test.ts` (order via fake repos).
- Integration (supertest, fake repo injection): `auth.flow.test.ts`, `predict.flow.test.ts`, `leaderboard.flow.test.ts`. (Full DynamoDB Local integration documented as Docker-dependent.)

### Step 9 — Docs [x]
`aidlc-docs/construction/backend/code/api-summary.md` (endpoints, files, story/PBT/security mapping).

### Step 10 — README [x]
`api/README.md` (run locally w/ DynamoDB Local, env, scripts, deploy note).

---

## Story traceability (mark on completion)
- [x] US-1.x identity/auth · [x] US-2.x groups · [x] US-3.x fixtures/sync · [x] US-4.x predictions/lock · [x] US-5.x scoring/leaderboard · [x] US-6.x visibility · [x] US-7.x ops/security

## Security / PBT
- 🔒 SECURITY-03/04/05/08/09/11/12/13/15 implemented in lib + middleware + services.
- 🧪 PBT-02 (mappers, token) + scoring persistence checks; example + property tests; `npm audit` must stay clean (SECURITY-10).

## Scope
~35–40 source/test files. Verification: `tsc` build + `vitest` (non-Docker tests) + `npm audit` run at end of generation.
