# Coding Conventions

**Analysis Date:** 2026-06-13

## Naming Patterns

**Files:**
- TypeScript source: `camelCase.ts` for utilities/libs (e.g., `clock.ts`, `logger.ts`, `config.ts`)
- TypeScript source: `camelCase.ts` for service/repo files (e.g., `scoring.ts`, `predictions.ts`, `goldenBoot.ts`)
- React components: `PascalCase.tsx` (e.g., `MatchCard.tsx`, `LandingPage.tsx`, `PlayerContext.tsx`)
- Page components: `{Name}Page.tsx` suffix for top-level pages (e.g., `FixturesPage.tsx`, `GroupsPage.tsx`)
- Context files: `{Name}Context.tsx` suffix (e.g., `PlayerContext.tsx`, `PrefsContext.tsx`)
- Test files: `{subject}.test.ts` for unit/integration, `{subject}.pbt.test.ts` for property-based tests
- Integration flow tests: `{feature}.flow.test.ts` (e.g., `predict.flow.test.ts`, `auth.flow.test.ts`)

**Functions:**
- Factory functions: `create{Name}(...)` pattern for service and repo constructors (e.g., `createScoringService`, `createMemoryRepositories`, `createLogger`)
- Builder functions: `build{Name}(...)` for app/router wiring (e.g., `buildApp`, `buildRouter`)
- React hooks: `use{Name}` prefix (e.g., `usePlayer`, `usePrefs`, `useCountUp`)
- Event handlers: `on{Action}` as prop names in React (e.g., `onSave`, `onClear`, `onJoker`)
- Predicates: plain boolean-returning names (e.g., `verifyPin`, `verifySession`)

**Variables:**
- camelCase throughout (TypeScript standard)
- Short names for well-scoped locals: `t` for test app, `r` for router, `p` for prediction, `m` for match
- Constants in SCREAMING_SNAKE_CASE: `STORAGE_KEY`, `REDACT_KEYS`, `ALPHABET`

**Types/Interfaces:**
- PascalCase interfaces: `PlayerRecord`, `ServiceDeps`, `TestApp`, `Config`
- Type aliases: PascalCase (e.g., `Stage`, `Outcome`, `BracketSide`, `Points`)
- All domain types defined in `packages/shared/src/types.ts` — single source of truth
- Interface for every service: `{Name}Service` (e.g., `ScoringService`, `AuthService`)
- Interface for every repo: `{Name}Repo` (e.g., `PlayerRepo`, `PredictionRepo`)
- Aggregate `Repositories` and `Services` interfaces in `api/src/repos/types.ts` and `api/src/services/container.ts`

## Code Style

**Formatting:**
- No Prettier config detected — formatting is enforced via TypeScript strictness and consistent manual style
- Single quotes for strings in TypeScript (observed throughout)
- Trailing commas used in multi-line objects/arrays
- 2-space indentation throughout

**Linting:**
- No `.eslintrc` found at repo root; eslint-disable comments appear inline for specific rules:
  - `// eslint-disable-next-line @typescript-eslint/no-namespace` — Express namespace augmentation in `api/src/middleware/index.ts`
  - `// eslint-disable-next-line no-console` — intentional `console.log/error` in `api/src/lib/logger.ts`
  - `// eslint-disable-next-line react-hooks/exhaustive-deps` — deliberate dep omission in `web/src/components/MatchCard.tsx`
- TypeScript strict mode enforced: `strict: true`, `noUncheckedIndexedAccess: true`, `noImplicitOverride: true`, `verbatimModuleSyntax: true`

## Import Organization

**Order (observed pattern):**
1. External packages (e.g., `import { Router } from 'express'`, `import { z } from 'zod'`)
2. Workspace packages (`import type { Match } from '@wc2026/shared'`)
3. Internal relative imports — types first (`import type { Config } from '../lib/config'`), then values

**`import type` usage:**
- Use `import type { ... }` for all type-only imports — enforced by `verbatimModuleSyntax: true` in tsconfig
- Mixed imports allowed: `import { Router, type Request, type RequestHandler } from 'express'`

**Path Aliases:**
- Workspace alias `@wc2026/shared` for the shared package — used in both `api/` and `web/`
- No path aliases configured in tsconfig; all relative imports use explicit `../` paths

## Error Handling

**API layer (`api/`):**
- All domain errors extend `AppError` in `api/src/lib/errors.ts`
- Subclasses: `ValidationError` (400), `AuthError` (401), `ForbiddenError` (403), `NotFoundError` (404), `ConflictError` (409), `LockedError` (409)
- Route handlers use `wrap()` or `wrapVoid()` helpers that catch any thrown error and pass it to Express's `next(err)`
- Centralised `errorHandler()` middleware in `api/src/middleware/index.ts` maps `AppError` subclasses to HTTP status + public message
- Body-parser errors (`entity.parse.failed`, `entity.too.large`) handled explicitly — returned as 400, never 500
- Throw domain errors from service layer; do not write `res.status(...)` directly in route handlers

**Web layer (`web/`):**
- API errors are `ApiError` instances (class in `web/src/api/client.ts`) with `.status` and `.message`
- Component-level catch: `err instanceof ApiError ? err.message : 'Could not log in'` pattern
- Errors stored in local `useState<string | null>` and rendered inline (no global error boundary observed)

## Logging

**Framework:** Custom structured JSON logger — `api/src/lib/logger.ts`

**Interface:**
```typescript
interface Logger {
  info(msg: string, fields?: Record<string, unknown>): void;
  warn(msg: string, fields?: Record<string, unknown>): void;
  error(msg: string, fields?: Record<string, unknown>): void;
  child(bound: Record<string, unknown>): Logger;
}
```

**Patterns:**
- One JSON object per line to stdout; `error` level goes to `console.error`, everything else to `console.log`
- Automatic redaction of sensitive keys: `pin`, `pinHash`, `token`, `authorization`, `sessionSigningSecret`, `footballApiToken`, `apiKey`
- Middleware creates a child logger per request: `logger.child({ requestId, method, path })`
- Services receive `Logger` via dependency injection — never import it directly
- Tests use a `silentLogger` (no-op) — never `console.log` in tests

## Comments

**When to Comment:**
- File-level comment on every source file describing its purpose and referencing the relevant requirement ID (e.g., `// Scoring service: ... (SR-4 / US-5.2)`, `// Typed application errors → mapped to HTTP status by errorHandler middleware (SECURITY-09/15)`)
- Inline comments explain non-obvious business rules or subtle invariants
- `// PBT-02: ...` comments in test files reference the design document ID for property-based test suites

**JSDoc/TSDoc:**
- Not used; preference is for clear type signatures and inline comments on exported interfaces

## Function Design

**Size:** Small, focused functions — services expose narrow interfaces (one method per operation)

**Parameters:** Dependency injection via positional parameters (repos, config, clock, logger passed in); avoid module-level singletons

**Return Values:**
- Async functions return `Promise<T>` explicitly in interfaces
- `void` return for fire-and-forget mutations (e.g., `wrapVoid` routes)
- Repo methods return `null` (not `undefined`) for "not found" — consistent with `T | null` signatures

## Module Design

**Exports:**
- Named exports only — no default exports observed anywhere
- Each file exports one primary construct (factory function + its interface type)
- `index.ts` barrel files used at `api/src/routes/index.ts` and `packages/shared/src/index.ts`

**Barrel Files:**
- `packages/shared/src/index.ts` — single entry point for all shared types, schemas, and utilities
- `api/src/routes/index.ts` — single `buildRouter` function exporting all routes
- `api/src/repos/types.ts` — exports all repo interfaces and the aggregate `Repositories` type
- `api/src/services/container.ts` — exports `Services` interface and `createServices` factory

## Dependency Injection Pattern

Services and repos are composed in `api/src/services/container.ts` via `createServices({ repos, config, clock, logger, footballApi })`. All dependencies flow down via function parameters — no module-level globals or singletons except the module-level `authToken` in `web/src/api/client.ts`.

The `Clock` abstraction (`api/src/lib/clock.ts`) — `{ now(): Date }` — is injected into every time-sensitive service, enabling deterministic tests via `fixedClock(date)`.

## Zod Validation

All input validation uses Zod schemas defined in `packages/shared/src/schemas.ts`. Route handlers call `validateBody(schema)` middleware before reaching service logic — never validate raw `req.body` in the service layer. Schema names follow `{entity}Schema` (e.g., `predictionInputSchema`, `playerNameSchema`).

---

*Convention analysis: 2026-06-13*
