# Live-Score Freshness & Liveness Overhaul — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cut live goal→screen latency from ~90s to ~20s and make a goal a visible moment, via SSE push, a long-running ESPN poller, HTTP caching, and frontend liveness (goal-flash, ticking minute, GOAL banner).

**Architecture:** A single long-running poller (`replicas:1`) writes DynamoDB every 12s while live. Each API pod runs an internal 5s Dynamo diff loop and pushes deltas over SSE (`GET /api/live`) to its own connected clients. The web client subscribes via `EventSource`, patches the React Query `['matches']` cache, and falls back to existing adaptive polling on disconnect. `GET /api/matches` gains ETag + a 5s TTL cache.

**Tech Stack:** TypeScript, Express 5, esbuild bundling, DynamoDB, React 19 + @tanstack/react-query 5, Vite, Vitest + supertest, Helm/ArgoCD on k3s.

## Global Constraints

- Node target `node22`; API bundled to CJS via esbuild (`api/scripts/bundle.mjs`).
- API routes are mounted under `/api` (`api/src/server.ts`). All new endpoints are `/api/...`.
- Auth is Bearer-token via `requireSession(config)` → `verifySession(token, config.sessionSigningSecret)` (`api/src/lib/token.ts`). `EventSource` cannot set headers, so SSE auth reads `?token=`.
- Tests: `vitest run` per workspace; integration tests use `makeTestApp()` + `supertest` (`api/test/support/testApp.ts`). CI gates deploy on `npm test` passing.
- Match status values: `SCHEDULED | TIMED | IN_PLAY | PAUSED | FINISHED`. "Live" = `IN_PLAY | PAUSED`.
- All new CSS animations go inside the existing `@media (prefers-reduced-motion: no-preference)` block in `web/src/styles.css`.
- Commit after every green step. Never push to `main` without explicit user approval (main auto-deploys to live dev).

---

## File Structure

**Backend (`api/`)**
- Create `api/src/lib/matchesCache.ts` — pure ETag + TTL cache helper.
- Modify `api/src/routes/index.ts` — ETag on `/matches`, add `/live/matches`, add `/live` SSE route.
- Create `api/src/services/liveBroadcaster.ts` — per-process diff loop + SSE client registry.
- Modify `api/src/middleware/index.ts` — add `requireSessionQuery(config)`.
- Modify `api/src/server.ts` — start the broadcaster, pass it to the router.
- Create `api/src/sync.live.ts` — long-running adaptive poller entrypoint.
- Modify `api/scripts/bundle.mjs` — bundle `dist/sync-live.cjs`.

**Frontend (`web/`)**
- Create `web/src/lib/liveStream.ts` — `EventSource` subscription helper.
- Create `web/src/hooks/useLiveScores.ts` — SSE → React Query cache patch + fallback.
- Create `web/src/hooks/useLiveMinute.ts` — client-side minute interpolation.
- Create `web/src/components/GoalBanner.tsx` — transient GOAL toast.
- Modify `web/src/components/MatchCard.tsx` — goal-flash on score change; use `useLiveMinute`.
- Modify `web/src/App.tsx` — mount `useLiveScores` + `<GoalBanner/>`.
- Modify `web/src/styles.css` — goal-flash keyframes.

**Infra (`infra/`)**
- Create `infra/helm/wc2026/templates/deployment-livepoller.yaml`.
- Modify `infra/helm/wc2026/values.yaml` — `sync.enabled: false`, add `livePoller` block.
- Modify `infra/helm/wc2026/templates/ingress.yaml` — SSE annotations (buffering off, long read timeout).

---

## Task 1: ETag + TTL cache for `GET /api/matches`

**Files:**
- Create: `api/src/lib/matchesCache.ts`
- Test: `api/test/lib/matchesCache.test.ts`
- Modify: `api/src/routes/index.ts` (the `/matches` route)
- Test: `api/test/integration/matches-etag.flow.test.ts`

> Test convention (whole plan): both api and web use vitest with `environment: 'node'` and `include: ['test/**/*.test.ts']`. All tests live under `<pkg>/test/**` with a `.test.ts` extension (never `.tsx`, never under `src/`). There is no DOM test stack — do NOT add `@testing-library/react`/jsdom. Frontend logic is tested as pure functions; thin React hook/component wrappers are verified by `tsc`/`vite build`, not unit tests.

**Interfaces:**
- Produces: `createMatchesCache(ttlMs: number, clock: Clock)` → `{ get(loader: () => Promise<MatchView[]>): Promise<{ body: MatchView[]; etag: string }> }`. `etag` is a quoted content hash. `get` returns a cached result while within `ttlMs`, else reloads.

- [ ] **Step 1: Write the failing unit test**

```ts
// api/test/lib/matchesCache.test.ts
import { describe, it, expect, vi } from 'vitest';
import { createMatchesCache } from '../../src/lib/matchesCache';
import { fixedClock } from '../../src/lib/clock';
import type { MatchView } from '../../src/services/dtos';

const sample = (over: Partial<MatchView> = {}): MatchView => ({
  id: 'm1', stage: 'GROUP_STAGE', groupName: 'A', matchday: 1,
  homeTeam: 'Argentina', homeCode: 'ARG', awayTeam: 'Brazil', awayCode: 'BRA',
  kickoff: '2026-06-12T00:00:00.000Z', status: 'IN_PLAY', startedAt: null, minute: 10,
  homeScore: 1, awayScore: 0, winner: null, locked: true, ...over,
}) as MatchView;

describe('matchesCache', () => {
  it('caches within TTL and reloads after expiry', async () => {
    const clock = fixedClock(new Date('2026-06-12T00:00:00.000Z'));
    const cache = createMatchesCache(5_000, clock);
    const loader = vi.fn().mockResolvedValue([sample()]);
    const a = await cache.get(loader);
    const b = await cache.get(loader);
    expect(loader).toHaveBeenCalledTimes(1); // second call served from cache
    expect(a.etag).toBe(b.etag);
  });

  it('produces a different etag when data changes', async () => {
    const clock = fixedClock(new Date('2026-06-12T00:00:00.000Z'));
    const cache1 = createMatchesCache(0, clock);
    const first = await cache1.get(async () => [sample({ homeScore: 1 })]);
    const second = await cache1.get(async () => [sample({ homeScore: 2 })]);
    expect(first.etag).not.toBe(second.etag);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd api && npx vitest run test/lib/matchesCache.test.ts`
Expected: FAIL — cannot find module `matchesCache`.

- [ ] **Step 3: Write minimal implementation**

```ts
// api/src/lib/matchesCache.ts
import { createHash } from 'node:crypto';
import type { Clock } from './clock';
import type { MatchView } from '../services/dtos';

export interface MatchesCache {
  get(loader: () => Promise<MatchView[]>): Promise<{ body: MatchView[]; etag: string }>;
}

// Collapses concurrent /matches reads to one Dynamo call within ttlMs, and derives a
// stable content ETag so unchanged responses can 304.
export function createMatchesCache(ttlMs: number, clock: Clock): MatchesCache {
  let hit: { at: number; body: MatchView[]; etag: string } | null = null;
  let inflight: Promise<{ body: MatchView[]; etag: string }> | null = null;

  return {
    async get(loader) {
      const now = clock.now().getTime();
      if (hit && now - hit.at < ttlMs) return { body: hit.body, etag: hit.etag };
      if (inflight) return inflight;
      inflight = (async () => {
        const body = await loader();
        const etag = `"${createHash('sha1').update(JSON.stringify(body)).digest('hex')}"`;
        hit = { at: clock.now().getTime(), body, etag };
        return { body, etag };
      })();
      try {
        return await inflight;
      } finally {
        inflight = null;
      }
    },
  };
}
```

- [ ] **Step 4: Run unit test to verify it passes**

Run: `cd api && npx vitest run test/lib/matchesCache.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Write the failing integration test**

```ts
// api/test/integration/matches-etag.flow.test.ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { makeTestApp } from '../support/testApp';

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

describe('GET /api/matches ETag', () => {
  it('returns an ETag and 304 when If-None-Match matches', async () => {
    const t = makeTestApp({ now: new Date('2026-06-12T00:00:00.000Z') });
    const login = (await request(t.app).post('/api/auth/login').send({ name: 'Etagger', pin: '1234' })).body;

    const first = await request(t.app).get('/api/matches').set(auth(login.token));
    expect(first.status).toBe(200);
    const etag = first.headers.etag;
    expect(etag).toBeTruthy();

    const second = await request(t.app)
      .get('/api/matches')
      .set(auth(login.token))
      .set('If-None-Match', etag);
    expect(second.status).toBe(304);
  });
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `cd api && npx vitest run test/integration/matches-etag.flow.test.ts`
Expected: FAIL — second response is 200, not 304.

- [ ] **Step 7: Wire the cache into the `/matches` route**

In `api/src/routes/index.ts`, add the import at the top with the other local imports:

```ts
import { createMatchesCache } from '../lib/matchesCache';
```

Inside `buildRouter(services, config)`, just after `const auth = requireSession(config);`, add:

```ts
  const matchesCache = createMatchesCache(5_000, services.clock ?? { now: () => new Date() });
```

> Note: `Services` does not expose `clock`. Use `{ now: () => new Date() }` inline instead — the cache only needs wall-clock time in production:

```ts
  const matchesCache = createMatchesCache(5_000, { now: () => new Date() });
```

Replace the existing matches route:

```ts
  r.get('/matches', auth, wrap(() => services.matches.list()));
```

with an explicit handler that sets the ETag and honours `If-None-Match`:

```ts
  r.get('/matches', auth, (req, res, next) => {
    matchesCache
      .get(() => services.matches.list())
      .then(({ body, etag }) => {
        res.setHeader('ETag', etag);
        res.setHeader('Cache-Control', 'no-cache'); // must revalidate, but 304 is cheap
        if (req.headers['if-none-match'] === etag) return res.status(304).end();
        res.json(body);
      })
      .catch(next);
  });
```

- [ ] **Step 8: Run both tests + full api suite**

Run: `cd api && npx vitest run test/integration/matches-etag.flow.test.ts test/lib/matchesCache.test.ts && npx vitest run`
Expected: PASS, and no regressions in the existing suite.

- [ ] **Step 9: Commit**

```bash
git add api/src/lib/matchesCache.ts api/test/lib/matchesCache.test.ts api/src/routes/index.ts api/test/integration/matches-etag.flow.test.ts
git commit -m "feat(api): ETag + 5s TTL cache on GET /matches"
```

---

## Task 2: Lean `GET /api/live/matches` endpoint

**Files:**
- Modify: `api/src/routes/index.ts`
- Test: `api/test/integration/live-matches.flow.test.ts`

**Interfaces:**
- Produces: `GET /api/live/matches` → `Array<{ id: string; homeScore: number|null; awayScore: number|null; status: MatchStatus; minute: number|null; startedAt: string|null }>` containing only matches with status `IN_PLAY` or `PAUSED`.

- [ ] **Step 1: Write the failing test**

```ts
// api/test/integration/live-matches.flow.test.ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { makeTestApp, sampleMatch } from '../support/testApp';

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

describe('GET /api/live/matches', () => {
  it('returns only in-play/paused matches with minimal fields', async () => {
    const t = makeTestApp({ now: new Date('2026-06-12T12:00:00.000Z') });
    await t.repos.matches.upsertMany([
      sampleMatch({ id: 'live1', status: 'IN_PLAY', homeScore: 1, awayScore: 0, minute: 23 }),
      sampleMatch({ id: 'done1', status: 'FINISHED', homeScore: 2, awayScore: 2 }),
      sampleMatch({ id: 'sched1', status: 'SCHEDULED' }),
    ]);
    const login = (await request(t.app).post('/api/auth/login').send({ name: 'Live', pin: '1234' })).body;
    const res = await request(t.app).get('/api/live/matches').set(auth(login.token));
    expect(res.status).toBe(200);
    expect(res.body.map((m: { id: string }) => m.id)).toEqual(['live1']);
    expect(res.body[0]).toEqual({
      id: 'live1', homeScore: 1, awayScore: 0, status: 'IN_PLAY', minute: 23,
      startedAt: res.body[0].startedAt,
    });
  });
});
```

> Before running: confirm the MatchRepo write method name. Check `api/src/repos/types.ts` for the matches repo — it is `upsertMany(matches: Match[])`. If the method differs, use the actual name in the test (grep `interface MatchRepo`).

- [ ] **Step 2: Run it to verify it fails**

Run: `cd api && npx vitest run test/integration/live-matches.flow.test.ts`
Expected: FAIL — 404 (route not defined).

- [ ] **Step 3: Add the route**

In `api/src/routes/index.ts`, immediately after the `/matches` route add:

```ts
  // Lean hot-path payload for the live ticker/stream: in-play matches only, minimal fields.
  r.get('/live/matches', auth, wrap(async () => {
    const all = await services.matches.list();
    return all
      .filter((m) => m.status === 'IN_PLAY' || m.status === 'PAUSED')
      .map((m) => ({
        id: m.id,
        homeScore: m.homeScore,
        awayScore: m.awayScore,
        status: m.status,
        minute: m.minute ?? null,
        startedAt: m.startedAt ?? null,
      }));
  }));
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd api && npx vitest run test/integration/live-matches.flow.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/src/routes/index.ts api/test/integration/live-matches.flow.test.ts
git commit -m "feat(api): lean GET /live/matches endpoint"
```

---

## Task 3: Query-token auth for SSE (`requireSessionQuery`)

**Files:**
- Modify: `api/src/middleware/index.ts`
- Test: `api/test/middleware/requireSessionQuery.test.ts`

**Interfaces:**
- Produces: `requireSessionQuery(config: Config): RequestHandler` — reads `req.query.token`, verifies it with `verifySession`, sets `req.callerId`, or calls `next(new AuthError())`.

- [ ] **Step 1: Write the failing test**

```ts
// api/test/middleware/requireSessionQuery.test.ts
import { describe, it, expect, vi } from 'vitest';
import { requireSessionQuery } from '../../src/middleware/index';
import { signSession } from '../../src/lib/token';
import { testConfig } from '../support/testApp';

function run(query: Record<string, unknown>) {
  const req = { query } as never;
  const res = {} as never;
  const next = vi.fn();
  requireSessionQuery(testConfig)(req, res, next);
  return { req, next };
}

describe('requireSessionQuery', () => {
  it('sets callerId for a valid token', () => {
    const token = signSession('player-1', testConfig.sessionSigningSecret, 30);
    const { req, next } = run({ token });
    expect((req as { callerId?: string }).callerId).toBe('player-1');
    expect(next).toHaveBeenCalledWith(); // no error
  });

  it('errors for a missing token', () => {
    const { next } = run({});
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});
```

> Before running: confirm the signer name/signature in `api/src/lib/token.ts` (grep `export function sign`). If it is `signSession(playerId, secret, ttlDays)`, the test is correct; otherwise adjust the call to the real signature.

- [ ] **Step 2: Run it to verify it fails**

Run: `cd api && npx vitest run test/middleware/requireSessionQuery.test.ts`
Expected: FAIL — `requireSessionQuery` not exported.

- [ ] **Step 3: Implement the middleware**

In `api/src/middleware/index.ts`, directly below `requireSession`, add:

```ts
// SSE variant: EventSource cannot set an Authorization header, so the session token
// is passed as ?token=. Same verification as requireSession.
export function requireSessionQuery(config: Config): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const token = typeof req.query.token === 'string' ? req.query.token : '';
    const callerId = token ? verifySession(token, config.sessionSigningSecret) : null;
    if (!callerId) {
      next(new AuthError());
      return;
    }
    req.callerId = callerId;
    next();
  };
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd api && npx vitest run test/middleware/requireSessionQuery.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/src/middleware/index.ts api/test/middleware/requireSessionQuery.test.ts
git commit -m "feat(api): query-token session auth for SSE"
```

---

## Task 4: Live broadcaster (per-process diff loop + SSE registry)

**Files:**
- Create: `api/src/services/liveBroadcaster.ts`
- Test: `api/test/services/liveBroadcaster.test.ts`

**Interfaces:**
- Produces:
  - `type LiveEvent = { type: 'score' | 'status' | 'minute'; matchId: string; home: number|null; away: number|null; status: string; minute: number|null }`
  - `createLiveBroadcaster(list: () => Promise<MatchView[]>, opts?: { intervalMs?: number }) → { start(): void; stop(): void; subscribe(fn: (e: LiveEvent) => void): () => void; tickOnce(): Promise<LiveEvent[]> }`
  - `tickOnce()` diffs current matches against the last snapshot and returns + broadcasts the events. `start()` calls `tickOnce()` on `setInterval(intervalMs)` (default 5000). `subscribe` returns an unsubscribe fn.
- Diff rules: emit `score` when `homeScore`/`awayScore` change; `status` when `status` changes; `minute` when `minute` changes. First tick seeds the snapshot silently (no events).

- [ ] **Step 1: Write the failing test**

```ts
// api/test/services/liveBroadcaster.test.ts
import { describe, it, expect } from 'vitest';
import { createLiveBroadcaster } from '../../src/services/liveBroadcaster';
import type { MatchView } from '../../src/services/dtos';

const m = (over: Partial<MatchView>): MatchView => ({
  id: 'm1', stage: 'GROUP_STAGE', groupName: 'A', matchday: 1,
  homeTeam: 'Argentina', homeCode: 'ARG', awayTeam: 'Brazil', awayCode: 'BRA',
  kickoff: '2026-06-12T00:00:00.000Z', status: 'IN_PLAY', startedAt: null, minute: 10,
  homeScore: 0, awayScore: 0, winner: null, locked: true, ...over,
}) as MatchView;

describe('liveBroadcaster', () => {
  it('seeds silently on first tick, then emits a score event on change', async () => {
    let data: MatchView[] = [m({ homeScore: 0, awayScore: 0 })];
    const b = createLiveBroadcaster(async () => data);
    expect(await b.tickOnce()).toEqual([]); // seed
    data = [m({ homeScore: 1, awayScore: 0 })];
    const events = await b.tickOnce();
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'score', matchId: 'm1', home: 1, away: 0 }),
    );
  });

  it('delivers events to subscribers and stops after unsubscribe', async () => {
    let data: MatchView[] = [m({ minute: 10 })];
    const b = createLiveBroadcaster(async () => data);
    const seen: unknown[] = [];
    const off = b.subscribe((e) => seen.push(e));
    await b.tickOnce(); // seed
    data = [m({ minute: 11 })];
    await b.tickOnce();
    off();
    data = [m({ minute: 12 })];
    await b.tickOnce();
    expect(seen).toHaveLength(1); // only the minute 10->11 change
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd api && npx vitest run test/services/liveBroadcaster.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the broadcaster**

```ts
// api/src/services/liveBroadcaster.ts
import type { MatchView } from './dtos';

export interface LiveEvent {
  type: 'score' | 'status' | 'minute';
  matchId: string;
  home: number | null;
  away: number | null;
  status: string;
  minute: number | null;
}

interface Snap { home: number | null; away: number | null; status: string; minute: number | null }

export interface LiveBroadcaster {
  start(): void;
  stop(): void;
  subscribe(fn: (e: LiveEvent) => void): () => void;
  tickOnce(): Promise<LiveEvent[]>;
}

// One instance per API process. Polls `list()` on an interval, diffs against the last
// snapshot, and pushes change events to all subscribers (the connected SSE clients).
export function createLiveBroadcaster(
  list: () => Promise<MatchView[]>,
  opts: { intervalMs?: number } = {},
): LiveBroadcaster {
  const intervalMs = opts.intervalMs ?? 5_000;
  const subs = new Set<(e: LiveEvent) => void>();
  let snap: Map<string, Snap> | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;

  function diff(m: MatchView, prev: Snap | undefined): LiveEvent[] {
    const base = { matchId: m.id, home: m.homeScore, away: m.awayScore, status: m.status, minute: m.minute ?? null };
    if (!prev) return [];
    const out: LiveEvent[] = [];
    if (prev.home !== m.homeScore || prev.away !== m.awayScore) out.push({ type: 'score', ...base });
    if (prev.status !== m.status) out.push({ type: 'status', ...base });
    if (prev.minute !== (m.minute ?? null)) out.push({ type: 'minute', ...base });
    return out;
  }

  return {
    subscribe(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
    async tickOnce() {
      let matches: MatchView[];
      try {
        matches = await list();
      } catch {
        return []; // skip this tick; keep last snapshot
      }
      const next = new Map<string, Snap>();
      const events: LiveEvent[] = [];
      for (const m of matches) {
        const prev = snap?.get(m.id);
        next.set(m.id, { home: m.homeScore, away: m.awayScore, status: m.status, minute: m.minute ?? null });
        if (snap) events.push(...diff(m, prev));
      }
      snap = next;
      for (const e of events) for (const fn of subs) fn(e);
      return events;
    },
    start() {
      if (timer) return;
      void this.tickOnce(); // seed immediately
      timer = setInterval(() => void this.tickOnce(), intervalMs);
      if (typeof timer === 'object' && 'unref' in timer) (timer as { unref: () => void }).unref();
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = null;
    },
  };
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd api && npx vitest run test/services/liveBroadcaster.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add api/src/services/liveBroadcaster.ts api/test/services/liveBroadcaster.test.ts
git commit -m "feat(api): live broadcaster diff loop + subscriber registry"
```

---

## Task 5: `GET /api/live` SSE route + wire broadcaster into the app

**Files:**
- Modify: `api/src/server.ts` (create + start broadcaster, pass to router)
- Modify: `api/src/routes/index.ts` (accept broadcaster, add SSE route)
- Test: `api/test/integration/live-sse.flow.test.ts`

**Interfaces:**
- Consumes: `createLiveBroadcaster` (Task 4), `requireSessionQuery` (Task 3).
- Produces: `buildRouter(services, config, broadcaster)` — new third param. `GET /api/live?token=<jwt>` streams `text/event-stream`; each `LiveEvent` is written as `event: <type>\ndata: <json>\n\n`; a `:hb\n\n` heartbeat every 15s.

- [ ] **Step 1: Write the failing integration test**

```ts
// api/test/integration/live-sse.flow.test.ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { makeTestApp } from '../support/testApp';

describe('GET /api/live SSE', () => {
  it('rejects without a token', async () => {
    const t = makeTestApp();
    const res = await request(t.app).get('/api/live');
    expect(res.status).toBe(401);
  });

  it('opens an event-stream with a valid token', async () => {
    const t = makeTestApp();
    const login = (await request(t.app).post('/api/auth/login').send({ name: 'Streamer', pin: '1234' })).body;
    // Abort quickly: SSE never ends, so cap the request and assert on headers.
    const res = await request(t.app)
      .get(`/api/live?token=${login.token}`)
      .buffer(false)
      .timeout({ deadline: 300 })
      .ok(() => true)
      .catch((e: { response?: { headers: Record<string, string> } }) => e.response);
    expect(res?.headers['content-type']).toContain('text/event-stream');
  });
});
```

> Note: SSE responses do not complete, so the second test caps the deadline and asserts on the response headers captured before the timeout. This is a known supertest+SSE pattern.

- [ ] **Step 2: Run it to verify it fails**

Run: `cd api && npx vitest run test/integration/live-sse.flow.test.ts`
Expected: FAIL — 404 / route missing.

- [ ] **Step 3: Thread the broadcaster through `buildApp` → `buildRouter`**

In `api/src/server.ts`, add the import:

```ts
import { createLiveBroadcaster, type LiveBroadcaster } from './services/liveBroadcaster';
```

Change the `buildApp` signature and body to create + start a broadcaster and pass it in:

```ts
export function buildApp(services: Services, config: Config, logger: Logger): Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  const broadcaster: LiveBroadcaster = createLiveBroadcaster(() => services.matches.list());
  broadcaster.start();

  app.use(helmet());
  app.use(cors({ origin: config.allowedOrigin }));
  app.use(requestContext(logger));
  app.use(express.json({ limit: '16kb' }));
  app.use(globalLimiter);

  app.get('/health', (_req, res) => res.json({ ok: true }));
  app.use('/api', buildRouter(services, config, broadcaster));

  app.use(notFoundHandler());
  app.use(errorHandler());
  return app;
}
```

> The broadcaster uses `timer.unref()`, so it will not keep the test process alive. Vitest tests that call `makeTestApp()` therefore start a real 5s loop that unrefs cleanly.

- [ ] **Step 4: Add the SSE route in `api/src/routes/index.ts`**

Update the import line:

```ts
import {
  requireSession,
  requireSessionQuery,
  validateBody,
  loginLimiter,
  joinLimiter,
  assistantLimiter,
  messagesLimiter,
} from '../middleware/index';
import type { LiveBroadcaster, LiveEvent } from '../services/liveBroadcaster';
```

Change the signature:

```ts
export function buildRouter(services: Services, config: Config, broadcaster: LiveBroadcaster): Router {
```

Inside, after `const auth = requireSession(config);` add:

```ts
  const authSse = requireSessionQuery(config);
```

Add the route (near `/live/matches`):

```ts
  // Server-Sent Events stream of live match deltas. Token via ?token= (EventSource
  // can't set headers). Falls back to polling on the client if this drops.
  r.get('/live', authSse, (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // belt-and-braces for proxies that honour it
    });
    res.write(':ok\n\n'); // open the stream immediately

    const send = (e: LiveEvent) => res.write(`event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`);
    const off = broadcaster.subscribe(send);
    const hb = setInterval(() => res.write(':hb\n\n'), 15_000);

    req.on('close', () => {
      clearInterval(hb);
      off();
    });
  });
```

- [ ] **Step 5: Update the other `buildRouter` caller in the test harness (if any) and run**

`makeTestApp` calls `buildApp`, which now creates the broadcaster internally, so no harness change is needed. Run:

Run: `cd api && npx vitest run test/integration/live-sse.flow.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Run the full api suite (broadcaster signature touched shared build path)**

Run: `cd api && npx vitest run`
Expected: PASS, no regressions.

- [ ] **Step 7: Commit**

```bash
git add api/src/server.ts api/src/routes/index.ts api/test/integration/live-sse.flow.test.ts
git commit -m "feat(api): GET /live SSE stream wired to broadcaster"
```

---

## Task 6: Long-running adaptive ESPN poller (`sync.live.ts`)

**Files:**
- Create: `api/src/sync.live.ts`
- Modify: `api/scripts/bundle.mjs`
- Test: `api/test/services/livePollInterval.test.ts`

**Interfaces:**
- Produces: `nextPollDelayMs(matches: { status: string }[]): number` — `12_000` if any match is `IN_PLAY`/`PAUSED`, else `60_000`. (Extracted so it is unit-testable without the process loop.)

- [ ] **Step 1: Write the failing test**

```ts
// api/test/services/livePollInterval.test.ts
import { describe, it, expect } from 'vitest';
import { nextPollDelayMs } from '../../src/sync.live';

describe('nextPollDelayMs', () => {
  it('is 12s when a match is live', () => {
    expect(nextPollDelayMs([{ status: 'SCHEDULED' }, { status: 'IN_PLAY' }])).toBe(12_000);
    expect(nextPollDelayMs([{ status: 'PAUSED' }])).toBe(12_000);
  });
  it('is 60s when nothing is live', () => {
    expect(nextPollDelayMs([{ status: 'SCHEDULED' }, { status: 'FINISHED' }])).toBe(60_000);
    expect(nextPollDelayMs([])).toBe(60_000);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd api && npx vitest run test/services/livePollInterval.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the poller**

```ts
// api/src/sync.live.ts
// Long-running adaptive poller (Kubernetes Deployment, replicas:1). Replaces the every-minute
// CronJob: polls ESPN every 12s while any match is live, 60s otherwise, so live scores land in
// DynamoDB within ~12s instead of up to 60s. Runs the same post-sync refreshes as sync.run.ts.
import { composeFromEnv } from './bootstrap';

export function nextPollDelayMs(matches: { status: string }[]): number {
  const live = matches.some((m) => m.status === 'IN_PLAY' || m.status === 'PAUSED');
  return live ? 12_000 : 60_000;
}

async function runForever(): Promise<void> {
  const { services, logger } = composeFromEnv();
  logger.info('live poller starting');
  let stopping = false;
  process.on('SIGTERM', () => { stopping = true; });
  process.on('SIGINT', () => { stopping = true; });

  while (!stopping) {
    try {
      const report = await services.sync.sync();
      // Same downstream refreshes the CronJob ran (best-effort, non-fatal).
      await services.espnFacts.ingest().catch((err) => logger.warn('espn facts ingest failed', { error: String(err) }));
      await services.goldenBoot.refresh().catch((err) => logger.warn('golden boot refresh failed', { error: String(err) }));
      await services.darkHorse.refresh().catch((err) => logger.warn('dark horse refresh failed', { error: String(err) }));
      await services.tournamentWinner.refresh().catch((err) => logger.warn('tournament winner refresh failed', { error: String(err) }));
      await services.notifications.sendKickoffReminders().catch((err) => logger.warn('kickoff reminders failed', { error: String(err) }));
      logger.info('live poll', { ok: report.ok, fetched: report.fetched, scored: report.scored });
    } catch (err) {
      logger.error('live poll failed', { error: err instanceof Error ? err.message : 'unknown' });
    }
    const matches = await services.matches.list().catch(() => []);
    const delay = nextPollDelayMs(matches);
    await new Promise((r) => setTimeout(r, delay));
  }
  logger.info('live poller stopped');
  process.exit(0);
}

// Only run the loop when executed directly (not when imported by the unit test).
if (process.env.VITEST !== 'true') {
  void runForever();
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd api && npx vitest run test/services/livePollInterval.test.ts`
Expected: PASS.

> Vitest sets `process.env.VITEST = 'true'`, so importing the module in the test does not start the loop.

- [ ] **Step 5: Add the bundle entrypoint**

In `api/scripts/bundle.mjs`, after the `sync.cjs` build line add:

```js
await build({ ...common, entryPoints: ['src/sync.live.ts'], outfile: 'dist/sync-live.cjs' });
```

and update the final log line:

```js
console.log('Bundled dist/server.cjs, dist/sync.cjs and dist/sync-live.cjs');
```

- [ ] **Step 6: Verify the bundle builds**

Run: `cd api && npm run build:server`
Expected: esbuild reports three outputs including `dist/sync-live.cjs`.

- [ ] **Step 7: Commit**

```bash
git add api/src/sync.live.ts api/scripts/bundle.mjs api/test/services/livePollInterval.test.ts
git commit -m "feat(api): long-running adaptive ESPN poller (sync.live)"
```

---

## Task 7: Helm — live-poller Deployment, disable CronJob

**Files:**
- Create: `infra/helm/wc2026/templates/deployment-livepoller.yaml`
- Modify: `infra/helm/wc2026/values.yaml`

**Interfaces:**
- Consumes: `dist/sync-live.cjs` (Task 6), the existing `wc2026.apiImage`, `wc2026.labels`, `wc2026.secretName` helpers, and `wc2026-api-config` ConfigMap (used by the CronJob).
- Produces: a `Deployment` named `wc2026-live-poller`, `replicas:1`, gated by `.Values.livePoller.enabled`.

- [ ] **Step 1: Add config to `values.yaml`**

Set the CronJob off and add a `livePoller` block. Change:

```yaml
sync:
  enabled: true
```

to:

```yaml
sync:
  # Superseded by the long-running livePoller (Deployment). Kept as a disabled fallback.
  enabled: false
```

Add after the `sync:` block:

```yaml
livePoller:
  enabled: true
  resources:
    requests: { cpu: 25m, memory: 128Mi }
    limits: { cpu: 250m, memory: 256Mi }
```

- [ ] **Step 2: Create the Deployment manifest**

Model it on `templates/cronjob-sync.yaml` (same image, service account, secret env, security context). Create `infra/helm/wc2026/templates/deployment-livepoller.yaml`:

```yaml
{{- if .Values.livePoller.enabled }}
apiVersion: apps/v1
kind: Deployment
metadata:
  name: wc2026-live-poller
  labels:
    {{- include "wc2026.labels" . | nindent 4 }}
spec:
  replicas: 1
  strategy:
    type: Recreate   # single writer — never two pollers at once
  selector:
    matchLabels:
      app: wc2026-live-poller
  template:
    metadata:
      labels:
        app: wc2026-live-poller
        {{- include "wc2026.labels" . | nindent 8 }}
    spec:
      serviceAccountName: {{ .Values.serviceAccount.name }}
      securityContext:
        runAsNonRoot: true
        seccompProfile:
          type: RuntimeDefault
      containers:
        - name: live-poller
          image: {{ include "wc2026.apiImage" . | quote }}
          imagePullPolicy: {{ .Values.image.pullPolicy }}
          command: ["node", "dist/sync-live.cjs"]
          envFrom:
            - configMapRef:
                name: wc2026-api-config
          env:
            - name: SESSION_SIGNING_SECRET
              valueFrom:
                secretKeyRef:
                  name: {{ include "wc2026.secretName" . }}
                  key: SESSION_SIGNING_SECRET
            - name: FOOTBALL_DATA_TOKEN
              valueFrom:
                secretKeyRef:
                  name: {{ include "wc2026.secretName" . }}
                  key: FOOTBALL_DATA_TOKEN
            - name: VAPID_PUBLIC_KEY
              valueFrom:
                secretKeyRef:
                  name: {{ include "wc2026.secretName" . }}
                  key: VAPID_PUBLIC_KEY
                  optional: true
            - name: VAPID_PRIVATE_KEY
              valueFrom:
                secretKeyRef:
                  name: {{ include "wc2026.secretName" . }}
                  key: VAPID_PRIVATE_KEY
                  optional: true
            - name: VAPID_SUBJECT
              valueFrom:
                secretKeyRef:
                  name: {{ include "wc2026.secretName" . }}
                  key: VAPID_SUBJECT
                  optional: true
          resources:
            {{- toYaml .Values.livePoller.resources | nindent 12 }}
          securityContext:
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: true
            capabilities:
              drop: ["ALL"]
{{- end }}
```

- [ ] **Step 3: Lint the chart**

Run: `helm lint infra/helm/wc2026 && helm template infra/helm/wc2026 -f infra/helm/wc2026/values-dev.yaml | grep -A2 "kind: Deployment" | grep wc2026-live-poller`
Expected: chart lints; the live-poller Deployment renders. (If `helm` is not installed locally, verify YAML is syntactically valid with `python3 -c "import yaml,sys; list(yaml.safe_load_all(open('infra/helm/wc2026/templates/deployment-livepoller.yaml')))"` — note Helm template braces will fail pure YAML parse, so prefer `helm template`.)

- [ ] **Step 4: Commit**

```bash
git add infra/helm/wc2026/templates/deployment-livepoller.yaml infra/helm/wc2026/values.yaml
git commit -m "feat(infra): live-poller Deployment; disable sync CronJob"
```

---

## Task 8: Ingress SSE annotations

**Files:**
- Modify: `infra/helm/wc2026/templates/ingress.yaml`

**Interfaces:** none (config only). Ensures the nginx ingress does not buffer `/api/live` and allows a long-lived connection.

- [ ] **Step 1: Inspect the current ingress**

Run: `cat infra/helm/wc2026/templates/ingress.yaml`
Identify the `metadata.annotations` block.

- [ ] **Step 2: Add SSE-friendly annotations**

Add these annotations to the ingress `metadata.annotations` (nginx ingress controller keys):

```yaml
    nginx.ingress.kubernetes.io/proxy-buffering: "off"
    nginx.ingress.kubernetes.io/proxy-read-timeout: "3600"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "3600"
```

> These apply per-ingress. `/api/live` is served by the same api backend, so buffering-off is safe for the whole api path (regular JSON responses are unaffected by disabling proxy buffering).

- [ ] **Step 3: Verify render**

Run: `helm template infra/helm/wc2026 -f infra/helm/wc2026/values-dev.yaml | grep -A6 "kind: Ingress"`
Expected: the three annotations appear.

- [ ] **Step 4: Commit**

```bash
git add infra/helm/wc2026/templates/ingress.yaml
git commit -m "feat(infra): disable ingress buffering for SSE (/api/live)"
```

---

## Task 9: Frontend — EventSource stream + `useLiveScores` hook

**Files:**
- Create: `web/src/lib/liveStream.ts`
- Create: `web/src/hooks/useLiveScores.ts`
- Modify: `web/src/App.tsx`
- Test: `web/test/liveScores.test.ts`

**Interfaces:**
- Consumes: the SSE event shape from Task 5 (`{ type, matchId, home, away, status, minute }`), `BASE` + `authToken` from `web/src/api/client.ts`.
- Produces:
  - `web/src/lib/liveStream.ts`: `openLiveStream(token: string, onEvent: (e: LiveScoreEvent) => void, onError: () => void): () => void` (returns a close fn); `type LiveScoreEvent = { type: 'score'|'status'|'minute'; matchId: string; home: number|null; away: number|null; status: string; minute: number|null }`.
  - `web/src/hooks/useLiveScores.ts`: `useLiveScores(): void` — subscribes while mounted, patches the `['matches']` cache, and on stream error leaves the existing polling to carry on.

- [ ] **Step 1: Write the failing hook test**

```ts
// web/test/liveScores.test.ts
import { describe, it, expect } from 'vitest';
import { applyLiveEvent } from '../src/hooks/useLiveScores';
import type { MatchView } from '../src/api/client';

const base: MatchView = {
  id: 'm1', stage: 'GROUP_STAGE', groupName: 'A', matchday: 1,
  homeTeam: 'Argentina', homeCode: 'ARG', awayTeam: 'Brazil', awayCode: 'BRA',
  kickoff: '2026-06-12T00:00:00.000Z', status: 'IN_PLAY', startedAt: null, minute: 10,
  homeScore: 0, awayScore: 0, winner: null, locked: true,
} as MatchView;

describe('applyLiveEvent', () => {
  it('patches the matching match score immutably', () => {
    const list = [base];
    const next = applyLiveEvent(list, { type: 'score', matchId: 'm1', home: 1, away: 0, status: 'IN_PLAY', minute: 12 });
    expect(next[0].homeScore).toBe(1);
    expect(next[0].minute).toBe(12);
    expect(next).not.toBe(list); // new array reference
    expect(list[0].homeScore).toBe(0); // original untouched
  });
  it('returns the same list when no match id matches', () => {
    const list = [base];
    const next = applyLiveEvent(list, { type: 'score', matchId: 'zzz', home: 9, away: 9, status: 'IN_PLAY', minute: 1 });
    expect(next).toBe(list);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd web && npx vitest run test/liveScores.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the stream helper**

```ts
// web/src/lib/liveStream.ts
const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

export interface LiveScoreEvent {
  type: 'score' | 'status' | 'minute';
  matchId: string;
  home: number | null;
  away: number | null;
  status: string;
  minute: number | null;
}

// Opens an EventSource to /api/live. EventSource auto-reconnects on transient drops;
// onError fires so the caller can lean on polling until the stream recovers. Returns a close fn.
export function openLiveStream(
  token: string,
  onEvent: (e: LiveScoreEvent) => void,
  onError: () => void,
): () => void {
  if (typeof EventSource === 'undefined') { onError(); return () => {}; }
  const es = new EventSource(`${BASE}/api/live?token=${encodeURIComponent(token)}`);
  const handler = (ev: MessageEvent) => {
    try { onEvent(JSON.parse(ev.data) as LiveScoreEvent); } catch { /* ignore malformed frame */ }
  };
  for (const type of ['score', 'status', 'minute']) es.addEventListener(type, handler as EventListener);
  es.onerror = () => onError();
  return () => es.close();
}
```

- [ ] **Step 4: Implement the hook (with the pure `applyLiveEvent` helper the test imports)**

```ts
// web/src/hooks/useLiveScores.ts
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { MatchView } from '../api/client';
import { getAuthToken } from '../api/client';
import { openLiveStream, type LiveScoreEvent } from '../lib/liveStream';

// Pure reducer: apply one SSE event to the cached matches list, immutably. Returns the
// same reference when nothing changes so React Query can skip re-renders.
export function applyLiveEvent(list: MatchView[], e: LiveScoreEvent): MatchView[] {
  let changed = false;
  const next = list.map((m) => {
    if (m.id !== e.matchId) return m;
    changed = true;
    return { ...m, homeScore: e.home, awayScore: e.away, status: e.status as MatchView['status'], minute: e.minute };
  });
  return changed ? next : list;
}

// Subscribes to the live SSE stream while mounted and patches the shared ['matches'] cache.
// On stream error the existing adaptive polling (liveRefetch) keeps data fresh — no gap.
export function useLiveScores(): void {
  const qc = useQueryClient();
  useEffect(() => {
    const token = getAuthToken();
    if (!token) return;
    const close = openLiveStream(
      token,
      (e) => qc.setQueryData<MatchView[]>(['matches'], (old) => (old ? applyLiveEvent(old, e) : old)),
      () => { /* rely on polling; EventSource retries on its own */ },
    );
    return close;
  }, [qc]);
}
```

- [ ] **Step 5: Export `getAuthToken` from the client**

In `web/src/api/client.ts`, next to `setAuthToken`, add:

```ts
export function getAuthToken(): string | null {
  return authToken;
}
```

- [ ] **Step 6: Mount the hook in `App.tsx`**

In `web/src/App.tsx`, import and call the hook inside the top-level app component (the same component that renders the router/`LiveTicker`):

```ts
import { useLiveScores } from './hooks/useLiveScores';
// ...inside the component body, before the return:
useLiveScores();
```

- [ ] **Step 7: Run the hook test + web suite**

Run: `cd web && npx vitest run test/liveScores.test.ts && npx vitest run`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add web/src/lib/liveStream.ts web/src/hooks/useLiveScores.ts web/src/api/client.ts web/src/App.tsx web/test/liveScores.test.ts
git commit -m "feat(web): SSE live-score subscription patches matches cache"
```

---

## Task 10: Frontend — goal-flash on score change

**Files:**
- Create: `web/src/hooks/useScoreFlash.ts`
- Test: `web/test/scoreFlash.test.ts`
- Modify: `web/src/components/MatchCard.tsx`
- Modify: `web/src/styles.css`

**Interfaces:**
- Produces:
  - `scoreChanged(prev: { h: number|null; a: number|null } | null, cur: { h: number|null; a: number|null }): boolean` — pure; `false` when `prev` is null (first render / seed), else true iff either score differs. **This is the unit-tested surface.**
  - `useScoreFlash(homeScore: number|null, awayScore: number|null): boolean` — thin React wrapper that returns `true` for ~900ms after `scoreChanged` fires. Verified by `tsc`/build, not unit-tested (no DOM stack).

- [ ] **Step 1: Write the failing pure test**

```ts
// web/test/scoreFlash.test.ts
import { describe, it, expect } from 'vitest';
import { scoreChanged } from '../src/hooks/useScoreFlash';

describe('scoreChanged', () => {
  it('is false on the seed (prev null)', () => {
    expect(scoreChanged(null, { h: 0, a: 0 })).toBe(false);
  });
  it('is true when the home or away score differs', () => {
    expect(scoreChanged({ h: 0, a: 0 }, { h: 1, a: 0 })).toBe(true);
    expect(scoreChanged({ h: 1, a: 0 }, { h: 1, a: 1 })).toBe(true);
  });
  it('is false when the score is unchanged', () => {
    expect(scoreChanged({ h: 2, a: 1 }, { h: 2, a: 1 })).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd web && npx vitest run test/scoreFlash.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the pure helper + the hook that uses it**

```ts
// web/src/hooks/useScoreFlash.ts
import { useEffect, useRef, useState } from 'react';

type Pair = { h: number | null; a: number | null };

// Pure: has the scoreline changed since the previous render? False on the seed (prev null).
export function scoreChanged(prev: Pair | null, cur: Pair): boolean {
  if (prev === null) return false;
  return prev.h !== cur.h || prev.a !== cur.a;
}

// Returns true briefly when the scoreline changes (never on first render), so the card
// can play a goal-flash. Mirrors the ref-diff pattern used in LiveTicker for finished matches.
export function useScoreFlash(homeScore: number | null, awayScore: number | null): boolean {
  const prev = useRef<Pair | null>(null);
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    const cur: Pair = { h: homeScore, a: awayScore };
    const changed = scoreChanged(prev.current, cur);
    prev.current = cur;
    if (changed) {
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 900);
      return () => clearTimeout(t);
    }
  }, [homeScore, awayScore]);
  return flash;
}
```

- [ ] **Step 4: Use it in `MatchCard.tsx`**

Add the import and call near the existing live/score computation (around `MatchCard.tsx:104`):

```ts
import { useScoreFlash } from '../hooks/useScoreFlash';
// ...inside the component, after `const live = ...`:
const scoreFlash = useScoreFlash(match.homeScore, match.awayScore);
```

Find the JSX element rendering the actual live/final scoreline (the element showing `match.homeScore`–`match.awayScore`). Add the flash class to its `className`:

```tsx
className={`mc-score${scoreFlash ? ' goal-flash' : ''}`}
```

> If the scoreline element already has a class, append ` goal-flash` conditionally rather than replacing it. Grep for `homeScore` in the JSX to locate the exact element.

- [ ] **Step 5: Add the keyframes to `styles.css`**

Inside the existing `@media (prefers-reduced-motion: no-preference) { ... }` block (near line 634), add:

```css
  .goal-flash { animation: goalFlash 0.9s cubic-bezier(0.2, 1.4, 0.4, 1); }
  @keyframes goalFlash {
    0%   { transform: scale(1);    color: inherit; }
    18%  { transform: scale(1.35); color: var(--gold, #f5b301); text-shadow: 0 0 12px var(--gold, #f5b301); }
    100% { transform: scale(1);    color: inherit; }
  }
```

- [ ] **Step 6: Run the test + web suite**

Run: `cd web && npx vitest run test/scoreFlash.test.ts && npx vitest run`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add web/src/hooks/useScoreFlash.ts web/test/scoreFlash.test.ts web/src/components/MatchCard.tsx web/src/styles.css
git commit -m "feat(web): goal-flash animation on live score change"
```

---

## Task 11: Frontend — client-side live minute interpolation

**Files:**
- Create: `web/src/hooks/useLiveMinute.ts`
- Test: `web/test/liveMinute.test.ts`
- Modify: `web/src/components/MatchCard.tsx`

**Interfaces:**
- Produces: `computeLiveMinute(match: { status: string; minute: number|null; startedAt: string|null }, now: number): number | null` — pure: returns the interpolated minute (last-known `minute` + minutes elapsed since `startedAt`) while live, else `null`; and `useLiveMinute(match): number | null` which ticks every 15s.

- [ ] **Step 1: Write the failing test**

```ts
// web/test/liveMinute.test.ts
import { describe, it, expect } from 'vitest';
import { computeLiveMinute } from '../src/hooks/useLiveMinute';

describe('computeLiveMinute', () => {
  const startedAt = '2026-06-12T12:00:00.000Z';
  it('adds elapsed minutes to the last-known minute while live', () => {
    const now = new Date('2026-06-12T12:03:30.000Z').getTime(); // 3.5 min after start
    expect(computeLiveMinute({ status: 'IN_PLAY', minute: 10, startedAt }, now)).toBe(13);
  });
  it('returns null when not live', () => {
    expect(computeLiveMinute({ status: 'FINISHED', minute: 90, startedAt }, Date.now())).toBeNull();
  });
  it('falls back to the raw minute when startedAt is missing', () => {
    expect(computeLiveMinute({ status: 'IN_PLAY', minute: 42, startedAt: null }, Date.now())).toBe(42);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd web && npx vitest run test/liveMinute.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// web/src/hooks/useLiveMinute.ts
import { useEffect, useState } from 'react';

interface LiveMatch { status: string; minute: number | null; startedAt: string | null }

// Interpolates the match clock locally so it ticks between 15s data syncs instead of jumping.
// minute (last known from provider) + whole minutes elapsed since startedAt.
export function computeLiveMinute(match: LiveMatch, now: number): number | null {
  if (match.status !== 'IN_PLAY' && match.status !== 'PAUSED') return null;
  if (match.minute == null) return null;
  if (!match.startedAt) return match.minute;
  const elapsedMin = Math.floor((now - new Date(match.startedAt).getTime()) / 60_000);
  return match.minute + Math.max(0, elapsedMin);
}

export function useLiveMinute(match: LiveMatch): number | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (match.status !== 'IN_PLAY' && match.status !== 'PAUSED') return;
    const id = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, [match.status]);
  return computeLiveMinute(match, now);
}
```

> Design note: `minute` from the provider already reflects the true clock at each 12s sync, so interpolation only fills the gaps and self-corrects on the next sync. `PAUSED` (half-time) still interpolates slowly; acceptable — the next sync corrects it. If half-time drift is undesirable, gate interpolation to `IN_PLAY` only; keep `PAUSED` showing the raw minute. (Chosen: interpolate both; corrected each sync.)

- [ ] **Step 4: Use it in `MatchCard.tsx`**

Replace the existing `minuteLabel` computation (around `MatchCard.tsx:106`, currently `const minuteLabel = state === 'Live' ? liveMinute(match) : null;`) so the displayed minute uses interpolation. Add the import:

```ts
import { useLiveMinute } from '../hooks/useLiveMinute';
```

and compute:

```ts
const interpolatedMinute = useLiveMinute(match);
const minuteLabel = state === 'Live' && interpolatedMinute != null ? `${interpolatedMinute}'` : null;
```

> Verify the existing `liveMinute(match)` return format (grep in `web/src/lib/format.ts`). Match its formatting (e.g. trailing `'`) so the UI is unchanged apart from ticking. If `liveMinute` adds extra formatting (stoppage time), keep calling it but pass the interpolated minute; otherwise the inline template above suffices.

- [ ] **Step 5: Run the test + web suite**

Run: `cd web && npx vitest run test/liveMinute.test.ts && npx vitest run`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add web/src/hooks/useLiveMinute.ts web/test/liveMinute.test.ts web/src/components/MatchCard.tsx
git commit -m "feat(web): interpolate live match minute so the clock ticks"
```

---

## Task 12: Frontend — transient "⚽ GOAL" banner

**Files:**
- Create: `web/src/components/GoalBanner.tsx`
- Test: `web/test/goalBus.test.ts`
- Modify: `web/src/lib/liveStream.ts` (event bus)
- Modify: `web/src/hooks/useLiveScores.ts` (pure `goalMessage` + emit)
- Modify: `web/src/App.tsx` (render the banner)
- Modify: `web/src/styles.css` (banner styles)

**Interfaces:**
- Consumes: score events from Task 9. A goal = a `score` event whose new total is higher than the cached total for that match.
- Produces (unit-tested, pure/node):
  - `onGoal(fn: (msg: string) => void): () => void` and `emitGoal(msg: string): void` in `web/src/lib/liveStream.ts` — a module-level string event bus.
  - `goalMessage(prev: MatchView | undefined, e: LiveScoreEvent): string | null` in `web/src/hooks/useLiveScores.ts` — returns a banner label when the event is a goal (new total > prev total), else `null`.
- Produces (build-verified, not unit-tested): `<GoalBanner/>` subscribes to `onGoal` and shows the latest goal for 4s.

- [ ] **Step 1: Write the failing pure test**

```ts
// web/test/goalBus.test.ts
import { describe, it, expect, vi } from 'vitest';
import { onGoal, emitGoal } from '../src/lib/liveStream';
import { goalMessage } from '../src/hooks/useLiveScores';
import type { MatchView } from '../src/api/client';

const match = (over: Partial<MatchView> = {}): MatchView => ({
  id: 'm1', stage: 'GROUP_STAGE', groupName: 'A', matchday: 1,
  homeTeam: 'Argentina', homeCode: 'ARG', awayTeam: 'Brazil', awayCode: 'BRA',
  kickoff: '2026-06-12T00:00:00.000Z', status: 'IN_PLAY', startedAt: null, minute: 10,
  homeScore: 1, awayScore: 1, winner: null, locked: true, ...over,
}) as MatchView;

describe('goal event bus', () => {
  it('delivers to subscribers until unsubscribed', () => {
    const seen: string[] = [];
    const off = onGoal((m) => seen.push(m));
    emitGoal('a');
    off();
    emitGoal('b');
    expect(seen).toEqual(['a']);
  });
});

describe('goalMessage', () => {
  it('returns a label when the total rises', () => {
    const prev = match({ homeScore: 1, awayScore: 1 });
    const msg = goalMessage(prev, { type: 'score', matchId: 'm1', home: 2, away: 1, status: 'IN_PLAY', minute: 55 });
    expect(msg).toContain('GOAL');
    expect(msg).toContain('ARG');
  });
  it('returns null when the total does not rise (correction/no goal)', () => {
    const prev = match({ homeScore: 2, awayScore: 1 });
    expect(goalMessage(prev, { type: 'score', matchId: 'm1', home: 1, away: 1, status: 'IN_PLAY', minute: 55 })).toBeNull();
  });
  it('returns null for non-score events and unknown matches', () => {
    expect(goalMessage(match(), { type: 'minute', matchId: 'm1', home: 1, away: 1, status: 'IN_PLAY', minute: 12 })).toBeNull();
    expect(goalMessage(undefined, { type: 'score', matchId: 'zzz', home: 9, away: 0, status: 'IN_PLAY', minute: 1 })).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd web && npx vitest run test/goalBus.test.ts`
Expected: FAIL — `onGoal`/`goalMessage` not exported.

- [ ] **Step 3: Add the goal event bus to `liveStream.ts`**

Append to `web/src/lib/liveStream.ts`:

```ts
type GoalListener = (msg: string) => void;
const goalListeners = new Set<GoalListener>();
export function onGoal(fn: GoalListener): () => void {
  goalListeners.add(fn);
  return () => goalListeners.delete(fn);
}
export function emitGoal(msg: string): void {
  for (const fn of goalListeners) fn(msg);
}
```

- [ ] **Step 4: Implement `GoalBanner.tsx`**

```tsx
// web/src/components/GoalBanner.tsx
import { useEffect, useState } from 'react';
import { onGoal } from '../lib/liveStream';

// Transient broadcast banner: shows the latest goal for 4s. Fired from useLiveScores.
export function GoalBanner() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    return onGoal((m) => {
      setMsg(m);
      const t = setTimeout(() => setMsg(null), 4_000);
      return () => clearTimeout(t);
    });
  }, []);
  if (!msg) return null;
  return <div className="goal-banner" role="status" aria-live="polite">{msg}</div>;
}
```

- [ ] **Step 5: Add pure `goalMessage` + emit from `useLiveScores`**

In `web/src/hooks/useLiveScores.ts`, add the exported pure helper (near `applyLiveEvent`):

```ts
// Pure: returns a banner label when this score event represents a new goal (total rose),
// else null. Extracted so it is unit-testable without React.
export function goalMessage(prev: MatchView | undefined, e: LiveScoreEvent): string | null {
  if (e.type !== 'score' || !prev) return null;
  const prevTotal = (prev.homeScore ?? 0) + (prev.awayScore ?? 0);
  const nextTotal = (e.home ?? 0) + (e.away ?? 0);
  if (nextTotal <= prevTotal) return null;
  return `⚽ GOAL — ${prev.homeCode ?? prev.homeTeam} ${e.home ?? 0}–${e.away ?? 0} ${prev.awayCode ?? prev.awayTeam}`;
}
```

Update the import from `../lib/liveStream` to include `emitGoal`:

```ts
import { openLiveStream, emitGoal, type LiveScoreEvent } from '../lib/liveStream';
```

Replace the `openLiveStream` call's `onEvent` callback (from Task 9) with one that fires the banner via the pure helper before patching the cache:

```ts
      (e) => {
        qc.setQueryData<MatchView[]>(['matches'], (old) => {
          if (!old) return old;
          const msg = goalMessage(old.find((m) => m.id === e.matchId), e);
          if (msg) emitGoal(msg);
          return applyLiveEvent(old, e);
        });
      },
```

- [ ] **Step 6: Render `<GoalBanner/>` in `App.tsx`**

In `web/src/App.tsx`, render the banner near the top of the app tree (alongside `LiveTicker`):

```tsx
import { GoalBanner } from './components/GoalBanner';
// ...in JSX, near the top-level layout:
<GoalBanner />
```

- [ ] **Step 7: Add banner styles to `styles.css`**

Add (base style outside the motion query; entrance animation inside the `prefers-reduced-motion: no-preference` block):

```css
.goal-banner {
  position: fixed; left: 50%; top: 12px; transform: translateX(-50%);
  z-index: 1000; padding: 10px 18px; border-radius: 999px;
  background: var(--gold, #f5b301); color: #1a1a1a; font-weight: 700;
  box-shadow: 0 6px 24px rgba(0,0,0,0.35); max-width: 92vw; text-align: center;
}
```

Inside the `@media (prefers-reduced-motion: no-preference)` block:

```css
  .goal-banner { animation: goalDrop 0.4s cubic-bezier(0.2, 1.5, 0.4, 1); }
  @keyframes goalDrop { from { transform: translate(-50%, -24px); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
```

- [ ] **Step 8: Run the test + web suite**

Run: `cd web && npx vitest run test/goalBus.test.ts && npx vitest run`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add web/src/components/GoalBanner.tsx web/test/goalBus.test.ts web/src/lib/liveStream.ts web/src/hooks/useLiveScores.ts web/src/App.tsx web/src/styles.css
git commit -m "feat(web): transient GOAL banner on live goals"
```

---

## Task 13: Full verification, PR, and deploy to dev

**Files:** none (build/test/deploy).

- [ ] **Step 1: Build shared + run the entire test suite from the repo root**

Run: `npm run build --workspace @wc2026/shared && npm test`
Expected: all workspace test suites PASS (this is exactly what CI runs and gates on).

- [ ] **Step 2: Typecheck + bundle the API**

Run: `cd api && npm run build && npm run build:server`
Expected: `tsc --noEmit` clean; esbuild emits `dist/server.cjs`, `dist/sync.cjs`, `dist/sync-live.cjs`.

- [ ] **Step 3: Build the web bundle**

Run: `cd web && npm run build`
Expected: Vite build succeeds with no type errors.

- [ ] **Step 4: Render the Helm chart for dev**

Run: `helm template infra/helm/wc2026 -f infra/helm/wc2026/values-dev.yaml > /tmp/rendered.yaml && grep -E "wc2026-live-poller|proxy-buffering" /tmp/rendered.yaml`
Expected: the live-poller Deployment and the ingress buffering annotation are present; no `wc2026-sync` CronJob (since `sync.enabled: false`).

- [ ] **Step 5: Push the branch and open a PR (do NOT merge yet)**

```bash
git push -u origin feat/live-scores-overhaul
gh pr create --title "Live-score freshness & liveness overhaul" \
  --body "SSE push + long-running ESPN poller + ETag cache + goal-flash/minute/banner. Cuts goal→screen ~90s→~20s. See docs/superpowers/specs/2026-07-02-live-scores-overhaul-design.md."
```

Expected: CI (`ci.yml`) runs `npm test` on the PR and goes green.

- [ ] **Step 6: STOP — get explicit user approval to deploy**

Deploying to dev = merging to `main`, which auto-builds images, bumps `values-dev.yaml`, and ArgoCD syncs to the live dev cluster. **Ask the user to confirm before merging.** Do not merge autonomously.

- [ ] **Step 7: Merge to deploy (only after approval)**

```bash
gh pr merge feat/live-scores-overhaul --squash
```

Then watch the rollout:

```bash
gh run watch   # CI: test → build images → bump values-dev
```

ArgoCD then auto-syncs. If the cluster is reachable locally: `kubectl rollout status deploy/wc2026-live-poller && kubectl rollout status deploy/wc2026-api`.

- [ ] **Step 8: Post-deploy smoke check**

- `GET https://<dev-host>/api/matches` returns an `ETag` header.
- `curl -N "https://<dev-host>/api/live?token=<valid>"` streams `:ok`/`event:` frames (does not buffer/hang).
- `kubectl get deploy wc2026-live-poller` shows `1/1`; `kubectl logs deploy/wc2026-live-poller` shows `live poll` lines.
- `kubectl get cronjob` shows no `wc2026-sync`.

---

## Self-Review

**Spec coverage:**
- Long-running live poller (12s/60s) → Task 6 + Task 7. ✅
- `GET /live` SSE → Task 5 (+ Task 3 auth, Task 4 broadcaster). ✅
- `/matches` ETag + TTL cache → Task 1. ✅
- Lean `/live/matches` → Task 2. ✅
- nginx/proxy no-buffering for SSE → Task 8 (corrected to ingress annotations; spec's `web/nginx.conf` line was inaccurate — that file is a static SPA server and does not proxy `/api`). ✅
- `useLiveScores` hook + polling fallback → Task 9. ✅
- Goal-flash → Task 10. ✅
- Minute interpolation → Task 11. ✅
- GOAL banner → Task 12. ✅
- Error handling (SSE reconnect/fallback, poller resilience, diff-loop skip-on-error, ETag fallback) → covered in Tasks 4, 6, 9. ✅
- Testing (unit + integration + frontend) → each task is TDD. ✅
- Deploy plan + user gate → Task 13. ✅

**Placeholder scan:** No TBD/TODO. Steps that require confirming an existing signature (repo method name, `signSession`, `liveMinute` format) name the exact file to grep and the fallback — these are verification steps, not placeholders.

**Type consistency:** `LiveEvent` (api) and `LiveScoreEvent` (web) share the same shape `{ type, matchId, home, away, status, minute }`. `createMatchesCache(ttlMs, clock)` used consistently. `buildRouter(services, config, broadcaster)` updated in Task 5 and consumed only via `buildApp`. `applyLiveEvent`, `computeLiveMinute`, `useScoreFlash`, `nextPollDelayMs` signatures match their tests. `getAuthToken`/`setAuthToken` co-located in client.

**Scope:** One PR, one deploy ("all at once" per user). Tasks are independently testable and committed.
