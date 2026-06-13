# Testing Patterns

**Analysis Date:** 2026-06-13

## Test Framework

**Runner:**
- Vitest 4.1.8
- Config: `api/vitest.config.ts`, `packages/shared/vitest.config.ts`, `web/vite.config.ts`
- All three configs set `environment: 'node'` and include `test/**/*.test.ts`

**Assertion Library:**
- Vitest built-in (`expect`) — no separate assertion library

**Property-Based Testing:**
- `fast-check` 3.23.1 (present in `api/` and `packages/shared/`)

**HTTP Integration Testing:**
- `supertest` 7.2.2 (in `api/` only)

**Run Commands:**
```bash
npm run test                   # Run all workspaces (root)
npm run test --workspace api   # API tests only
vitest run                     # Single run (from workspace directory)
vitest                         # Watch mode (from workspace directory)
```

No coverage configuration is present in any vitest config — coverage is not enforced.

## Test File Organization

**Location:**
- Tests live in a top-level `test/` directory within each workspace — NOT co-located with source
- `api/test/` mirrors `api/src/` structure with subdirectories: `integration/`, `lib/`, `repos/`, `services/`, `support/`
- `packages/shared/test/` — flat directory alongside `packages/shared/src/`
- `web/test/` — flat directory alongside `web/src/`

**Naming:**
- Unit/example tests: `{subject}.test.ts`
- Property-based tests: `{subject}.pbt.test.ts`
- Integration flow tests: `{feature}.flow.test.ts`

**Structure:**
```
api/
  test/
    integration/          # HTTP flow tests via supertest
    lib/                  # Unit tests for lib utilities
    repos/                # Property-based tests for DynamoDB mappers
    services/             # Unit tests for individual services
    support/
      testApp.ts          # Shared test harness factory
packages/shared/
  test/
    *.test.ts             # Example-based unit tests
    *.pbt.test.ts         # Property-based invariant tests
web/
  test/
    format.test.ts        # Unit tests for format utilities
```

## Test Structure

**Suite Organization:**
```typescript
import { describe, it, expect } from 'vitest';

describe('scoringService.scoreMatch', () => {
  it('persists computePoints for each prediction of a finished match', async () => {
    // arrange
    const repos = createMemoryRepositories();
    await repos.matches.upsert(sampleMatch({ id: 'm1', status: 'FINISHED', homeScore: 2, awayScore: 1 }));
    // act
    const scoring = createScoringService(repos.predictions, repos.matches, repos.bracket);
    const count = await scoring.scoreMatch('m1');
    // assert
    expect(count).toBe(3);
  });
});
```

**Patterns:**
- No `beforeEach`/`afterEach` lifecycle hooks — each `it` block creates a fresh in-memory state
- No test-level mocking via `vi.mock()` — dependencies are injected directly as typed fakes
- Arrange-act-assert inline within each `it` block
- Human-readable `it` descriptions that reference user story IDs where relevant (e.g., `'accepts a prediction before kickoff and returns it'`, `'auth flow (US-1.1/1.2)'`)

## Mocking

**Framework:** No `vi.mock()` or spy framework — all test doubles are hand-rolled typed fakes.

**Patterns:**

Silent logger (used in `api/test/services/` tests):
```typescript
const noopLogger = { info() {}, warn() {}, error() {}, debug() {} } as unknown as Logger;
```

In-memory `Clock` replacement (deterministic time):
```typescript
const fixedClock = (iso: string) => ({ now: () => new Date(iso) });
// or via the shared helper:
import { fixedClock } from '../../src/lib/clock';
const clock = fixedClock(new Date('2026-06-15T19:00:00.000Z'));
```

External API client stub (inline interface implementation):
```typescript
const fakeEspn: EspnClient = {
  async fetchPlayerPool() { return []; },
  async fetchMatchFirstGoals() { return [...]; },
  async fetchFinishedEventGoals() { return [...]; },
};
```

**What to Mock:**
- External I/O (ESPN API, football data API) — implement the interface inline
- Time (use `fixedClock` from `api/src/lib/clock.ts`)
- Logger (use `silentLogger` from `api/test/support/testApp.ts` or inline no-op object)

**What NOT to Mock:**
- Repositories — use `createMemoryRepositories()` which is a full in-memory implementation
- Services — use the real service created with memory repos
- Internal business logic — test it directly via the real implementation

## Test Harness

**`api/test/support/testApp.ts`** — the central test factory for integration tests:

```typescript
export function makeTestApp(opts: { now?: Date; providerMatches?: Match[] } = {}): TestApp {
  const repos = createMemoryRepositories();
  const clock = opts.now ? fixedClock(opts.now) : systemClock;
  const footballApi: FootballApiClient = {
    fetchCompetitionMatches: async () => opts.providerMatches ?? [],
  };
  const services = createServices({ repos, config: testConfig, clock, logger: silentLogger, footballApi });
  const app = buildApp(services, testConfig, silentLogger);
  return { app, repos, services };
}
```

- `opts.now` — pin the server clock to a specific instant for lock-time tests
- `opts.providerMatches` — seed the football data API stub
- Returns `{ app, repos, services }` — tests can pre-seed repos directly, then exercise the app via HTTP

**`sampleMatch(overrides)`** — minimal valid `Match` factory with sensible defaults:
```typescript
export function sampleMatch(over: Partial<Match> = {}): Match {
  return {
    id: 'm1', stage: 'GROUP_STAGE', groupName: 'A', matchday: 1,
    homeTeam: 'Brazil', homeCode: 'BRA', awayTeam: 'Argentina', awayCode: 'ARG',
    kickoff: '2026-06-15T18:00:00.000Z', status: 'SCHEDULED',
    homeScore: null, awayScore: null, placeholder: false,
    ...over,
  };
}
```

## Property-Based Testing

Uses `fast-check` (`fc`) for invariant and round-trip tests.

**Naming convention:** files with `.pbt.test.ts` suffix, suites tagged with IDs like `(PBT-02)`, `(SP-1)`, `(TP-1..TP-3)`, `(RT-1)`.

**Patterns:**
```typescript
import fc from 'fast-check';

const arbGoal = fc.integer({ min: 0, max: 30 });
const arbScore: fc.Arbitrary<Score> = fc.record({ home: arbGoal, away: arbGoal });

it('SP-2: exact prediction ⇔ 12', () => {
  fc.assert(
    fc.property(arbScore, arbScore, (p, a) => {
      const exact = p.home === a.home && p.away === a.away;
      expect(computePoints(p, a) === 12).toBe(exact);
    }),
  );
});
```

**What gets PBT coverage:**
- `packages/shared/test/scoring.pbt.test.ts` — scoring engine invariants (range, symmetry, outcome/points relationships)
- `packages/shared/test/schemas.pbt.test.ts` — Zod schema round-trips (serialize → parse)
- `api/test/repos/mappers.pbt.test.ts` — DynamoDB mapper round-trips (domain → DynamoDB item → domain)
- `api/test/lib/token.test.ts` — session token round-trip via `fast-check` uuid generation

## Integration Tests

Location: `api/test/integration/*.flow.test.ts`

**Pattern:** Full HTTP round-trips via `supertest` against a real Express app backed by in-memory repos.

```typescript
import request from 'supertest';
import { makeTestApp, sampleMatch } from '../support/testApp';

describe('prediction flow (US-4.x)', () => {
  it('accepts a prediction before kickoff and returns it', async () => {
    const t = makeTestApp({ now: new Date('2026-06-15T10:00:00.000Z') });
    await t.repos.matches.upsert(sampleMatch({ id: 'm1', kickoff: KICKOFF }));
    const token = await loginToken(t.app, 'Sam', '1234');

    const put = await request(t.app)
      .put('/api/predictions/m1')
      .set('Authorization', `Bearer ${token}`)
      .send({ home: 2, away: 1 });
    expect(put.status).toBe(200);
  });
});
```

**Coverage areas:**
- `auth.flow.test.ts` — signup, resume, PIN validation, session token
- `predict.flow.test.ts` — prediction CRUD, lock enforcement
- `bracket.flow.test.ts` — knockout bracket picks
- `joker-lock.flow.test.ts`, `joker-global.flow.test.ts` — Joker constraints
- `golden-boot.flow.test.ts`, `dark-horse.flow.test.ts`, `player-of-tournament.flow.test.ts`, `tournament-winner.flow.test.ts` — award picks
- `leaderboard.flow.test.ts`, `account.flow.test.ts`, `feedback.flow.test.ts`, `tour.flow.test.ts`

## Fixtures and Factories

**Test Data:**
```typescript
// In api/test/support/testApp.ts — spread-override pattern
sampleMatch({ id: 'm1', status: 'FINISHED', homeScore: 2, awayScore: 1 })

// Direct repo seeding with minimal records
const now = new Date().toISOString();
await repos.predictions.put({
  playerId: 'a', matchId: 'm1', home: 2, away: 1, points: 0,
  createdAt: now, updatedAt: now,
});
```

**Location:**
- `api/test/support/testApp.ts` — `sampleMatch` and `makeTestApp` (shared across all API tests)
- No dedicated fixture files or factories beyond these two helpers

## Coverage

**Requirements:** None enforced — no coverage thresholds in any vitest config.

**View Coverage:**
```bash
npx vitest run --coverage   # add --coverage flag to any workspace
```

## Test Types

**Unit Tests:**
- Pure function tests: scoring engine, format utilities, PIN hashing, token signing, dark horse multipliers, section splitting
- Service tests: created with real service + in-memory repos, no HTTP layer
- Files: `api/test/services/`, `api/test/lib/`, `packages/shared/test/`, `web/test/`

**Integration Tests:**
- Full HTTP request/response cycle via supertest
- Real Express app with in-memory storage
- Clock-pinned for deterministic lock-time behaviour
- Files: `api/test/integration/`

**Property-Based Tests:**
- Invariant verification for scoring, sorting, and serialization
- Files: `*.pbt.test.ts` in `api/test/repos/`, `packages/shared/test/`

**E2E Tests:**
- Not present — no browser-level or E2E framework configured

## Common Patterns

**Async Testing:**
```typescript
it('rejects a prediction after kickoff (locked)', async () => {
  const t = makeTestApp({ now: new Date('2026-06-15T19:00:00.000Z') });
  await t.repos.matches.upsert(sampleMatch({ id: 'm1', kickoff: KICKOFF }));
  const token = await loginToken(t.app, 'Sam', '1234');
  const put = await request(t.app).put('/api/predictions/m1').set('Authorization', `Bearer ${token}`).send({ home: 1, away: 1 });
  expect(put.status).toBe(409);
});
```

**Error/Rejection Testing:**
```typescript
// HTTP status codes checked directly
expect(res.status).toBe(400);
expect(res.body.error).toMatch(/malformed/i);

// Service-level: assert no state change
expect(await scoring.scoreMatch('unfinished-match')).toBe(0);
expect((await repos.predictions.get('a', 'm2'))?.points).toBe(0);
```

**Time-Sensitive Tests (lock boundary):**
```typescript
// Two test apps — one before, one after kickoff
const before = makeTestApp({ now: new Date('2026-06-15T10:00:00.000Z') });
const after  = makeTestApp({ now: new Date('2026-06-15T19:00:00.000Z') });
```

**data-testid Hooks:**
Web components are annotated with `data-testid` attributes throughout `web/src/` (75 usages), following the pattern `{element}-{matchId}` (e.g., `pred-home-m1`, `joker-m1`, `receipt-m1`, `live-m1`). No browser tests currently use them — they are forward-compatible hooks for future E2E tests.

---

*Testing analysis: 2026-06-13*
