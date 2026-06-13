<!-- refreshed: 2026-06-13 -->
# Architecture

**Analysis Date:** 2026-06-13

## System Overview

```text
┌────────────────────────────────────────────────────────────────────┐
│                     Browser (SPA)                                  │
│  `web/src/main.tsx`  →  `web/src/App.tsx`                          │
│  React 19 + React Router 7 + TanStack Query 5                      │
│  Pages: `web/src/pages/`   Components: `web/src/components/`       │
│  Auth state: `web/src/context/PlayerContext.tsx`                    │
└──────────────────────────┬─────────────────────────────────────────┘
                           │  HTTP (fetch, Bearer JWT)
                           │  `web/src/api/client.ts`
                           ▼
┌────────────────────────────────────────────────────────────────────┐
│                     API — Express 5                                 │
│  Entry: `api/src/app.ts` (dev) / `api/src/lambda.ts` (AWS Lambda)  │
│  Composition root: `api/src/bootstrap.ts`                          │
│  HTTP pipeline: `api/src/server.ts`                                │
│  Routes: `api/src/routes/index.ts`  →  prefix `/api`              │
├──────────────────┬───────────────────┬──────────────────────────── │
│   Middleware     │    Services        │   Repositories              │
│ `api/src/        │  `api/src/         │  `api/src/repos/`           │
│  middleware/`    │   services/`       │                             │
│  - requestContext│  - auth            │  Interface: `types.ts`      │
│  - requireSession│  - players         │  DynamoDB: `dynamo.ts`      │
│  - validateBody  │  - groups          │  In-memory: `memory.ts`     │
│  - rate limiters │  - matches         │  Mappers: `mappers.ts`      │
│  - errorHandler  │  - predictions     │                             │
│                  │  - scoring         │                             │
│                  │  - leaderboard     │                             │
│                  │  - bracket         │                             │
│                  │  - goldenBoot      │                             │
│                  │  - darkHorse       │                             │
│                  │  - tournamentWinner│                             │
│                  │  - pott            │                             │
│                  │  - feedback        │                             │
│                  │  - espnFacts       │                             │
│                  │  - sync            │                             │
└──────────────────┴──────────────────┬┴─────────────────────────────┘
                                      │
                   ┌──────────────────┴────────────────────┐
                   │                                       │
                   ▼                                       ▼
    ┌──────────────────────────┐         ┌─────────────────────────┐
    │  DynamoDB (single-table) │         │  External APIs           │
    │  `api/src/repos/dynamo.ts`│        │  football-data.org       │
    │  or In-Memory (tests/dev) │        │  `api/src/integration/   │
    │  `api/src/repos/memory.ts`│        │   footballApiClient.ts`  │
    └──────────────────────────┘         │  ESPN (no-key)           │
                                         │  `api/src/integration/   │
                                         │   espnClient.ts`         │
                                         └─────────────────────────┘

┌────────────────────────────────────────────────────────────────────┐
│  Scheduled Lambda (EventBridge)                                    │
│  `api/src/sync.lambda.ts`  →  `services/sync.ts`                   │
│  Pulls fixtures+results, upserts matches, triggers scoring.        │
└────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────┐
│  Shared Package  `packages/shared/src/`                            │
│  Domain types, scoring engine, validation schemas, date utils.     │
│  Used by BOTH `api` and `web` — single source of truth.            │
└────────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Bootstrap | Composition root: loads config, selects repo backend, wires services+app | `api/src/bootstrap.ts` |
| Server | Express app factory: security middleware pipeline, route mounting | `api/src/server.ts` |
| Router | All REST routes mapped to service calls; schema validation inline | `api/src/routes/index.ts` |
| Middleware | requestContext, requireSession (JWT), validateBody (Zod), rate limiters, errorHandler | `api/src/middleware/index.ts` |
| Services | Domain business logic; one file per domain concept | `api/src/services/` |
| Repositories | Storage abstraction; two implementations: DynamoDB and in-memory | `api/src/repos/` |
| Integration | External HTTP clients (football-data.org, ESPN) | `api/src/integration/` |
| Shared | Pure domain types, scoring, schemas, date utilities | `packages/shared/src/` |
| Web API client | Typed fetch wrapper; single `api` object; module-level `authToken` state | `web/src/api/client.ts` |
| PlayerContext | Session state (login/logout), persisted to `localStorage` | `web/src/context/PlayerContext.tsx` |
| PrefsContext | Timezone and theme preferences, persisted to `localStorage` | `web/src/context/PrefsContext.tsx` |
| Pages | Route-level React components; use TanStack Query for data fetching | `web/src/pages/` |
| Components | Shared UI components (Nav, MatchCard, LiveTicker, etc.) | `web/src/components/` |
| Sync Lambda | Scheduled EventBridge handler: fetch-upsert-score pipeline | `api/src/sync.lambda.ts` |

## Pattern Overview

**Overall:** Layered monorepo — Clean-layer Express API (Routes → Services → Repositories) backed by DynamoDB single-table, fronted by a React SPA.

**Key Characteristics:**
- Repository pattern with swappable backends: same `Repositories` interface implemented by both `dynamo.ts` (production) and `memory.ts` (tests/dev). Switched via `PERSISTENCE=memory` env var at `api/src/bootstrap.ts:24`.
- Factory functions everywhere — no classes, no `new`. All services, repos, and the Express app are created via `create*` / `build*` functions.
- Composition root pattern: `bootstrap.ts` is the single place that reads config, selects the repo backend, and wires the full dependency graph. Entry points (`app.ts`, `lambda.ts`, `sync.lambda.ts`) call `composeFromEnv()` and do nothing else.
- Shared package is the single source of truth for domain types and scoring logic — imported by both `api` and `web`.
- Stateless sessions: HMAC-SHA256 signed tokens (no DB lookup on each request). Issued at login, verified in `requireSession` middleware.

## Layers

**Routes Layer:**
- Purpose: HTTP contract — parse params, dispatch to services, serialize responses
- Location: `api/src/routes/index.ts`
- Contains: Route definitions, inline Zod schema declarations for request bodies
- Depends on: Services, Middleware
- Used by: `api/src/server.ts`

**Service Layer:**
- Purpose: Business logic, domain rules, authorization checks
- Location: `api/src/services/`
- Contains: One file per domain concept (auth, players, groups, matches, predictions, scoring, leaderboard, bracket, goldenBoot, darkHorse, tournamentWinner, pott, feedback, espnFacts, sync)
- Depends on: Repositories, lib utilities (`clock`, `errors`, `token`, `pin`, `ids`)
- Used by: Routes

**Repository Layer:**
- Purpose: Persistence abstraction; isolates storage from business logic
- Location: `api/src/repos/`
- Contains: `types.ts` (interfaces), `dynamo.ts` (DynamoDB impl), `memory.ts` (in-memory impl), `mappers.ts` (domain ↔ DynamoDB item)
- Depends on: AWS SDK (dynamo only), shared domain types
- Used by: Services

**Integration Layer:**
- Purpose: External HTTP clients — isolated adapters for third-party APIs
- Location: `api/src/integration/`
- Contains: `footballApiClient.ts` (football-data.org, fixture sync), `espnClient.ts` (ESPN squad/scorer data)
- Depends on: native `fetch`
- Used by: Services (`sync`, `goldenBoot`, `espnFacts`)

**Lib Layer:**
- Purpose: Cross-cutting utilities with no domain knowledge
- Location: `api/src/lib/`
- Contains: `config.ts`, `logger.ts`, `clock.ts`, `errors.ts`, `token.ts`, `pin.ts`, `ids.ts`
- Depends on: Node.js builtins only
- Used by: All layers

**Shared Package:**
- Purpose: Domain types and pure business logic shared between API and web
- Location: `packages/shared/src/`
- Contains: `types.ts`, `scoring.ts`, `schemas.ts`, `dates.ts`, `darkHorse.ts`, `sections.ts`, `awards.ts`
- Depends on: Zod (schemas only)
- Used by: `api` and `web`

**Web Layer:**
- Purpose: React SPA — renders UI, calls API, manages client state
- Location: `web/src/`
- Contains: Pages, components, contexts, API client, lib utilities
- Depends on: `@wc2026/shared`, API over HTTP
- Used by: Browser

## Data Flow

### Prediction Submission (Authenticated)

1. User submits score on `FixturesPage` (`web/src/pages/FixturesPage.tsx`) — optimistic update via TanStack Query
2. `api.upsertPrediction()` called on `web/src/api/client.ts` — `PUT /api/predictions/:matchId`
3. `requireSession` middleware verifies Bearer JWT, extracts `callerId` (`api/src/middleware/index.ts:31`)
4. `validateBody(predictionInputSchema)` parses + validates the body (`api/src/routes/index.ts:84`)
5. `PredictionService.upsert()` enforces lock rule (kickoff time ≥ now), writes via `PredictionRepo.put()` (`api/src/services/predictions.ts:39`)
6. Response serialized back; TanStack Query cache updated

### Fixture Sync (Scheduled Lambda)

1. EventBridge fires `sync.lambda.ts` handler (`api/src/sync.lambda.ts`)
2. `SyncService.sync()` calls `footballApi.fetchCompetitionMatches()` to pull all fixtures (`api/src/services/sync.ts:37`)
3. Each match upserted via `MatchRepo.upsert()`
4. If score changed, `ScoringService.scoreMatch()` re-scores all predictions for that match using `scoreBreakdown()` from `packages/shared/src/scoring.ts`
5. Updated `Prediction` and `BracketPick` records written back to DynamoDB

### Authentication / Sign-up (Login-or-Create)

1. `POST /api/auth/login` with `{ name, pin }` → `AuthService.login()` (`api/src/services/auth.ts:28`)
2. Looks up player by `nameKey` (lower-trimmed name). If exists, verifies bcrypt PIN hash.
3. If not found, creates new `PlayerRecord` atomically (DynamoDB condition expression prevents races).
4. Returns `{ playerId, name, token, tourSeen }` — token is HMAC-signed, stored in `localStorage` by `PlayerContext`.

**State Management:**
- Server state: TanStack Query (caching, polling, optimistic updates)
- Auth session: React Context + `localStorage` (`web/src/context/PlayerContext.tsx`)
- User preferences (timezone, theme): React Context + `localStorage` (`web/src/context/PrefsContext.tsx`)
- No global client-side store (no Redux/Zustand)

## Key Abstractions

**`Repositories` interface:**
- Purpose: Decouples services from storage backend; enables in-memory testing
- Location: `api/src/repos/types.ts:170`
- Pattern: Interface-per-aggregate (`PlayerRepo`, `MatchRepo`, `PredictionRepo`, etc.), bundled into a single `Repositories` bag passed through `bootstrap.ts`

**`Services` interface:**
- Purpose: Typed service bag passed into route handlers; no service locator
- Location: `api/src/services/container.ts:23`
- Pattern: `createServices()` factory wires all services from the `Repositories` bag

**`Clock` interface:**
- Purpose: Injectable time abstraction enabling deterministic tests of lock behavior
- Location: `api/src/lib/clock.ts`
- Pattern: `systemClock` in production; `fixedClock(date)` in tests

**`AppError` hierarchy:**
- Purpose: Typed domain errors mapped to HTTP status by `errorHandler` middleware
- Location: `api/src/lib/errors.ts`
- Pattern: `ValidationError(400)`, `AuthError(401)`, `ForbiddenError(403)`, `NotFoundError(404)`, `ConflictError(409)`, `LockedError(409)`

**`@wc2026/shared` scoring engine:**
- Purpose: Pure, IO-free scoring logic shared between API (scoring service) and web (preview/display)
- Location: `packages/shared/src/scoring.ts`
- Pattern: Functions only; no side effects; `scoreBreakdown(prediction, actual)` returns additive point components

## Entry Points

**Local dev server:**
- Location: `api/src/app.ts`
- Triggers: `npm run dev` in `api/` workspace
- Responsibilities: Calls `composeFromEnv()`, binds Express to `PORT` (default 4000), optionally runs startup sync

**AWS Lambda (API Gateway):**
- Location: `api/src/lambda.ts`
- Triggers: API Gateway HTTP event
- Responsibilities: Wraps the Express app with `@codegenie/serverless-express`

**AWS Lambda (Sync):**
- Location: `api/src/sync.lambda.ts`
- Triggers: EventBridge scheduled rule (also manual invocation)
- Responsibilities: Runs fixture/result sync and rescoring

**Web SPA:**
- Location: `web/src/main.tsx`
- Triggers: Browser load
- Responsibilities: Mounts React root with `QueryClientProvider`, `BrowserRouter`, `PlayerProvider`, `PrefsProvider`

## Architectural Constraints

- **Threading:** Node.js single-threaded event loop. All async operations use `await`; no worker threads.
- **Global state:** `authToken` module-level variable in `web/src/api/client.ts:68` — set via `setAuthToken()` from `PlayerContext`. One mutable singleton per page load.
- **Circular imports:** None detected. Dependency direction is strict: Routes → Services → Repos; Lib has no upward dependencies.
- **Single-table DynamoDB:** All domain data in one table. Keys follow `PK/SK` composite key pattern (e.g. `PLAYER#<id>` / `PROFILE`). See `api/src/repos/mappers.ts` for key construction.
- **Lock enforcement:** Match lock is time-based only (`clock.now() >= kickoff`). Enforced exclusively in `MatchService.isLocked()` (`api/src/services/matches.ts:13`) and checked by service methods before mutations.
- **No server-side sessions:** Token is stateless HMAC. Revocation requires secret rotation.

## Anti-Patterns

### Bypassing the service layer from routes

**What happens:** Routes call `services.*` methods directly and receive typed DTOs.
**Why it's wrong:** Adding direct `repos.*` calls in `routes/index.ts` would bypass authorization, lock checks, and audit logic in the service layer.
**Do this instead:** All business logic stays in `api/src/services/`; routes only call service methods.

### Importing shared scoring from within the API service layer without going through `@wc2026/shared`

**What happens:** `scoring.ts` imports `scoreBreakdown` from `@wc2026/shared`. It must stay that way.
**Why it's wrong:** Duplicating scoring logic in `api/src/` creates divergence with the web display logic.
**Do this instead:** Always import scoring functions from `packages/shared/src/scoring.ts` via `@wc2026/shared`.

## Error Handling

**Strategy:** Typed `AppError` subclasses thrown in services; `errorHandler` middleware in `api/src/middleware/index.ts:68` maps them to HTTP status codes. Unknown errors become 500. Body-parser errors are treated as 4xx.

**Patterns:**
- Services throw typed errors (`LockedError`, `ForbiddenError`, `NotFoundError`, etc.) — never raw `Error`
- Route handlers use `wrap()` / `wrapVoid()` helper closures that catch and forward to `next(err)` (`api/src/routes/index.ts:19,42`)
- Web: `ApiError` class wraps non-OK responses (`web/src/api/client.ts:48`); TanStack Query `onError` handlers show toasts

## Cross-Cutting Concerns

**Logging:** Structured JSON via `createLogger()` (`api/src/lib/logger.ts`). Child loggers carry `requestId`, `method`, `path` per request. No client-side logging.
**Validation:** Zod schemas defined in `packages/shared/src/schemas.ts` (domain input schemas) and inline in `api/src/routes/index.ts` (request body schemas). `validateBody()` middleware replaces `req.body` with the parsed value.
**Authentication:** Stateless HMAC-SHA256 Bearer tokens. `requireSession` middleware reads `Authorization` header, verifies token, and sets `req.callerId` (`api/src/middleware/index.ts:31`).

---

*Architecture analysis: 2026-06-13*
