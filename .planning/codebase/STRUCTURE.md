# Codebase Structure

**Analysis Date:** 2026-06-13

## Directory Layout

```
wc2026-predictor/                  # npm workspaces monorepo root
├── api/                           # Express 5 REST API (Node.js workspace)
│   ├── scripts/                   # Build + DB setup scripts
│   ├── src/
│   │   ├── app.ts                 # Local dev entry point
│   │   ├── lambda.ts              # AWS Lambda (API Gateway) entry point
│   │   ├── sync.lambda.ts         # AWS Lambda (EventBridge sync) entry point
│   │   ├── sync.run.ts            # Manual sync runner (CLI)
│   │   ├── bootstrap.ts           # Composition root
│   │   ├── server.ts              # Express app factory
│   │   ├── integration/           # External HTTP clients
│   │   │   ├── footballApiClient.ts
│   │   │   └── espnClient.ts
│   │   ├── lib/                   # Cross-cutting utilities (no domain)
│   │   │   ├── clock.ts
│   │   │   ├── config.ts
│   │   │   ├── errors.ts
│   │   │   ├── ids.ts
│   │   │   ├── logger.ts
│   │   │   ├── pin.ts
│   │   │   └── token.ts
│   │   ├── middleware/            # Express middleware pipeline
│   │   │   └── index.ts
│   │   ├── repos/                 # Repository layer
│   │   │   ├── types.ts           # Repo interfaces + backend-only domain types
│   │   │   ├── dynamo.ts          # DynamoDB implementation
│   │   │   ├── memory.ts          # In-memory implementation (tests/dev)
│   │   │   └── mappers.ts         # Domain <-> DynamoDB item mappers
│   │   ├── routes/                # HTTP route definitions
│   │   │   └── index.ts
│   │   └── services/              # Business logic layer
│   │       ├── container.ts       # Service factory + Services interface
│   │       ├── dtos.ts            # Response types (shared across services)
│   │       ├── auth.ts
│   │       ├── bracket.ts
│   │       ├── darkHorse.ts
│   │       ├── espnFacts.ts
│   │       ├── feedback.ts
│   │       ├── goldenBoot.ts
│   │       ├── groups.ts
│   │       ├── leaderboard.ts
│   │       ├── matches.ts
│   │       ├── playerOfTournament.ts
│   │       ├── players.ts
│   │       ├── predictions.ts
│   │       ├── scoring.ts
│   │       ├── sync.ts
│   │       └── tournamentWinner.ts
│   └── test/
│       ├── integration/           # HTTP-level flow tests (supertest)
│       ├── lib/                   # Unit tests for lib utilities
│       ├── repos/                 # Unit + property-based tests for repos/mappers
│       ├── services/              # Unit tests for services
│       └── support/
│           └── testApp.ts         # Test harness: makeTestApp(), sampleMatch()
├── web/                           # React 19 SPA (Vite, TypeScript workspace)
│   ├── public/                    # Static assets
│   └── src/
│       ├── main.tsx               # SPA entry point
│       ├── App.tsx                # Root router + RequireAuth guard
│       ├── styles.css             # Global CSS
│       ├── tour.ts                # Onboarding tour step definitions
│       ├── updates.ts             # Changelog / updates content
│       ├── vite-env.d.ts          # Vite env type shims
│       ├── api/
│       │   └── client.ts          # Typed fetch wrapper + all API calls
│       ├── components/            # Reusable UI components
│       │   ├── Nav.tsx
│       │   ├── MatchCard.tsx
│       │   ├── LiveTicker.tsx
│       │   ├── LeaderboardTable.tsx
│       │   ├── OnboardingTour.tsx
│       │   ├── Confetti.tsx
│       │   ├── Flag.tsx
│       │   ├── StatusBadge.tsx
│       │   ├── ProbabilitiesModal.tsx
│       │   ├── DarkHorseAward.tsx
│       │   ├── TournamentWinnerAward.tsx
│       │   └── PlayerOfTournamentAward.tsx
│       ├── context/               # React context providers
│       │   ├── PlayerContext.tsx  # Auth session + localStorage
│       │   └── PrefsContext.tsx   # Timezone + theme + localStorage
│       ├── lib/                   # Pure client-side utilities
│       │   ├── flags.ts           # Flag emoji/image helpers
│       │   ├── format.ts          # Match state, kickoff, points formatting
│       │   ├── search.ts          # Player search helpers
│       │   └── teams.ts           # Team name canonicalization
│       └── pages/                 # Route-level page components
│           ├── LandingPage.tsx
│           ├── FixturesPage.tsx   # Main prediction interface
│           ├── MatchDetailPage.tsx
│           ├── AwardsPage.tsx     # Hub for all pre-tournament picks
│           ├── GoldenBootPage.tsx
│           ├── GroupsPage.tsx
│           ├── GroupDetailPage.tsx
│           ├── GlobalLeaderboardPage.tsx
│           ├── StandingsPage.tsx
│           ├── MyBreakdownPage.tsx
│           ├── SettingsPage.tsx
│           ├── HelpPage.tsx
│           ├── UpdatesPage.tsx
│           └── FeedbackPage.tsx
├── packages/
│   └── shared/                    # @wc2026/shared — used by api + web
│       └── src/
│           ├── index.ts           # Barrel re-export
│           ├── types.ts           # Domain types (Match, Prediction, Group, etc.)
│           ├── scoring.ts         # Pure scoring engine
│           ├── schemas.ts         # Zod validation schemas
│           ├── dates.ts           # Date utilities
│           ├── darkHorse.ts       # Dark-horse points logic
│           ├── sections.ts        # Match section grouping
│           └── awards.ts          # Awards lock logic
├── infra/                         # Infrastructure-as-code
│   ├── helm/wc2026/               # Helm chart (k3s deployment)
│   │   └── templates/             # K8s manifests (deployment, service, ingress, etc.)
│   ├── gitops/                    # ArgoCD gitops config
│   │   ├── apps/
│   │   ├── bootstrap/
│   │   └── projects/
│   └── terraform/                 # Terraform modules
│       ├── environments/aws/
│       └── modules/               # data, k3s
├── .github/
│   └── workflows/
│       ├── ci.yml                 # CI pipeline
│       └── promote-to-prod.yml    # Prod promotion workflow
├── .planning/codebase/            # GSD codebase map documents
├── aidlc-docs/                    # AIDLC project documentation
├── aidlc-rules/                   # AIDLC rule definitions
├── UI/                            # UI design assets / mockups
├── package.json                   # Monorepo root (npm workspaces)
├── tsconfig.base.json             # Shared TypeScript base config
└── .nvmrc                         # Node version pin (22)
```

## Directory Purposes

**`api/src/services/`:**
- Purpose: All business logic for the application
- Contains: One TypeScript module per domain concept; each exports a typed service interface and a `create*Service()` factory function
- Key files: `container.ts` (wires all services), `scoring.ts` (persists points), `sync.ts` (fixture ingestion pipeline)

**`api/src/repos/`:**
- Purpose: Storage abstraction layer
- Contains: `types.ts` defines all repo interfaces; `dynamo.ts` and `memory.ts` are interchangeable implementations; `mappers.ts` contains pure domain ↔ DynamoDB item converters
- Key files: `types.ts` (start here for data model), `mappers.ts` (DynamoDB key scheme)

**`api/src/lib/`:**
- Purpose: Infrastructure utilities with zero domain knowledge
- Contains: Config loader, logger, HMAC token, bcrypt PIN hash, Clock interface, UUID/invite-code generators, typed error classes
- Key files: `errors.ts` (all domain error types), `config.ts` (all env var requirements), `clock.ts` (testable time)

**`api/src/integration/`:**
- Purpose: Isolated adapters for third-party HTTP APIs
- Contains: `footballApiClient.ts` (football-data.org, fixture+result data), `espnClient.ts` (ESPN squad and goalscorer data)

**`web/src/pages/`:**
- Purpose: Route-level components, each corresponding to a URL path defined in `App.tsx`
- Contains: One `.tsx` file per route; pages use TanStack Query for data, `api/client.ts` for calls
- Key files: `FixturesPage.tsx` (main prediction workflow), `AwardsPage.tsx` (pre-tournament picks hub)

**`web/src/context/`:**
- Purpose: Global React state that spans pages
- Contains: `PlayerContext.tsx` (auth session, localStorage persistence), `PrefsContext.tsx` (timezone, theme)

**`web/src/api/`:**
- Purpose: Single typed HTTP client for all API calls
- Contains: `client.ts` — defines all request/response types, the `api` object, and `ApiError`

**`packages/shared/src/`:**
- Purpose: Domain types and pure business logic shared between `api` and `web`; no I/O or framework dependencies
- Contains: Types, scoring math, Zod schemas, award lock dates, match section ordering

**`infra/`:**
- Purpose: Deployment configuration — not part of the runtime codebase
- Contains: Helm chart for k3s Kubernetes, ArgoCD gitops manifests, Terraform for AWS/k3s provisioning

**`api/test/`:**
- Purpose: All API tests
- Contains: Integration (HTTP flow tests using `supertest`), service unit tests, repo unit tests + PBT, lib unit tests
- Key files: `test/support/testApp.ts` (shared test harness with `makeTestApp()` and `sampleMatch()`)

## Key File Locations

**Entry Points:**
- `api/src/app.ts`: Local dev Express server
- `api/src/lambda.ts`: AWS Lambda (API Gateway) handler
- `api/src/sync.lambda.ts`: AWS Lambda (EventBridge sync) handler
- `web/src/main.tsx`: React SPA root

**Configuration:**
- `api/src/lib/config.ts`: All environment variable definitions and validation
- `tsconfig.base.json`: Shared TypeScript compiler options (strict, ES2022, noUncheckedIndexedAccess)
- `package.json`: Workspace root, Node >=22 engine requirement

**Core Logic:**
- `api/src/bootstrap.ts`: Composition root — where all dependencies are wired
- `api/src/routes/index.ts`: Complete REST API surface
- `api/src/repos/types.ts`: All repository interfaces and backend domain types
- `api/src/services/container.ts`: All service interfaces and factory
- `packages/shared/src/scoring.ts`: Scoring point calculation (source of truth)
- `packages/shared/src/types.ts`: Core domain types (`Match`, `Prediction`, `BracketPick`, etc.)

**Testing:**
- `api/test/support/testApp.ts`: `makeTestApp()` — creates a full in-memory test instance
- `api/test/integration/*.flow.test.ts`: HTTP-level integration tests per feature
- `packages/shared/test/scoring.pbt.test.ts`: Property-based tests for the scoring engine

## Naming Conventions

**Files:**
- Services: `camelCase.ts` matching domain concept (e.g. `goldenBoot.ts`, `playerOfTournament.ts`)
- Pages: `PascalCasePage.tsx` (e.g. `FixturesPage.tsx`, `AwardsPage.tsx`)
- Components: `PascalCase.tsx` (e.g. `MatchCard.tsx`, `LiveTicker.tsx`)
- Tests: `<subject>.test.ts` for unit tests; `<feature>.flow.test.ts` for integration flows; `<subject>.pbt.test.ts` for property-based tests
- Contexts: `PascalCaseContext.tsx`

**Directories:**
- `src/` for source, `test/` for tests (API mirrors this: `api/src/`, `api/test/`)
- Domain directories are lowercase plural nouns: `services/`, `repos/`, `routes/`, `middleware/`, `pages/`, `components/`

**Exports:**
- Services: default-export-free; named exports for interface + factory: `export interface FooService`, `export function createFooService()`
- Repos: same pattern: `export interface FooRepo`, implemented inside `createMemoryRepositories()` / `createDynamoRepositories()`
- Shared: barrel re-export from `packages/shared/src/index.ts`

## Where to Add New Code

**New API domain feature (e.g. a new pick type):**
1. Define domain types in `packages/shared/src/types.ts` (or a new file re-exported from `packages/shared/src/index.ts`)
2. Add repo interface to `api/src/repos/types.ts`; add in-memory implementation to `api/src/repos/memory.ts`; add DynamoDB implementation to `api/src/repos/dynamo.ts` with key helpers in `api/src/repos/mappers.ts`
3. Register the new repo in `Repositories` interface in `api/src/repos/types.ts` and instantiate in both `createMemoryRepositories()` and `createDynamoRepositories()`
4. Create `api/src/services/<feature>.ts` with a typed service interface and `create<Feature>Service()` factory
5. Register in `api/src/services/container.ts` — both the `Services` interface and `createServices()` body
6. Add routes to `api/src/routes/index.ts`
7. Add Zod request body schemas (inline in routes or imported from `@wc2026/shared`)
8. Write integration tests in `api/test/integration/<feature>.flow.test.ts` using `makeTestApp()`
9. Add `api/web/src/api/client.ts` calls and new page/component under `web/src/pages/` or `web/src/components/`

**New API route on an existing domain:**
- Add the route to `api/src/routes/index.ts`, add a method to the relevant service interface in `api/src/services/<feature>.ts`

**New React page:**
- Create `web/src/pages/<Name>Page.tsx`
- Add `<Route>` in `web/src/App.tsx` (wrap in `<RequireAuth>` for protected routes)
- Add nav link to `web/src/components/Nav.tsx` if needed

**New shared utility:**
- Pure logic (no I/O): add to `packages/shared/src/` and re-export from `packages/shared/src/index.ts`
- API-only utility: `api/src/lib/`
- Web-only utility: `web/src/lib/`

**New test helper:**
- Shared API test fixtures/factories: add to `api/test/support/testApp.ts`

## Special Directories

**`.planning/`:**
- Purpose: GSD planning and codebase map documents
- Generated: No (written by GSD mapper agents)
- Committed: Yes

**`aidlc-docs/`:**
- Purpose: AIDLC project lifecycle documentation (requirements, functional design, NFR design, build plans)
- Generated: No
- Committed: Yes

**`aidlc-rules/`:**
- Purpose: AIDLC rule definitions and construction guidelines
- Generated: No
- Committed: Yes

**`infra/`:**
- Purpose: Kubernetes, Helm, ArgoCD, and Terraform deployment configuration
- Generated: No (hand-authored IaC)
- Committed: Yes

---

*Structure analysis: 2026-06-13*
