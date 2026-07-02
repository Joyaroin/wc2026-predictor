# Live-Score Freshness & Liveness Overhaul — Design

**Date:** 2026-07-02
**Status:** Approved (design)
**Branch:** `feat/live-scores-overhaul`

## Goal

Beat dedicated live-score apps (FotMob/ESPN) on time-to-screen and on the felt
"liveness" of a goal. Reduce goal→screen latency from ~90s worst-case to ~20s,
and make a goal a visible *moment* instead of a silent number swap.

## Problem (measured from the codebase)

Latency chain for a goal reaching a user:

| Stage | Mechanism | Cost | Source |
|---|---|---|---|
| ESPN → DynamoDB | k8s CronJob `schedule: "* * * * *"` (60s) | up to 60s | `infra/helm/wc2026/values.yaml:40`, `api/src/services/sync.ts` |
| API serving | `/matches` reads Dynamo directly, no cache | ~fast | `api/src/services/matches.ts:18`, `api/src/routes/index.ts:111` |
| Server → client | HTTP polling, 30s while live / 60s idle | up to 30s | `web/src/lib/liveRefetch.ts:15` |
| Transport | Pure REST — no WebSocket, no SSE | — | (grep: zero matches) |

Worst case ≈ 90s, average ≈ 45s. The 60s CronJob is the dominant term.

Additionally: animations exist (`pulse`, `pop`, `fadeUp`, `tickIn` in
`web/src/styles.css`, correctly gated under `prefers-reduced-motion`) but
**nothing detects a score *change*** — a goal silently swaps the number. The
live `minute` only updates on the 60s sync, so the clock jumps instead of
ticking.

## Architecture decision (approved)

**Push mechanism: API self-poll + SSE.** The score-writer is a separate process
from the API pods, so a change must cross processes to reach a browser. Chosen
approach: one long-running ESPN poller (`replicas=1`) writes DynamoDB; each API
pod runs an internal Dynamo diff loop and pushes deltas over Server-Sent Events
to its own connected clients. No new infrastructure (no Streams consumer, no
Redis), replica-safe, works with existing Dynamo + nginx.

**Ingestion: CronJob → long-running Deployment (approved).** k8s cron cannot go
below 60s and we are already at the max. A long-running poller polls ESPN every
**12s while any match is live, 60s otherwise**, killing the ingestion floor.

## Components

### Backend / infra

1. **Long-running live poller** — new run mode `api/src/sync.live.ts` deployed as
   a k8s **Deployment (`replicas: 1`)**. Adaptive cadence: 12s live / 60s idle.
   Reuses the existing sync pipeline (`api/src/services/sync.ts`). The CronJob
   manifest is retained but disabled by default (fallback).
2. **`GET /live` SSE endpoint** — `Content-Type: text/event-stream`. Each API
   replica runs an internal 5s Dynamo diff loop and emits `score`, `status`, and
   `minute` change events. Heartbeat comment every 15s to survive proxy idle
   timeouts.
3. **`GET /matches` hardening** — `ETag` + `If-None-Match` → `304 Not Modified`;
   a small in-process 5s TTL cache collapsing concurrent reads to one Dynamo
   call; `Cache-Control` header for edge caching.
4. **`GET /live/matches` lean endpoint** — in-play matches only, minimal fields
   (id, scores, status, minute) for the hot path.
5. **nginx** — `proxy_buffering off;` on the `/live` proxy location so SSE
   streams unbuffered (`web/nginx.conf`).

### Frontend

6. **`useLiveScores` hook** — subscribes to `/live` via `EventSource`, patches
   the React Query `['matches']` cache on events. **Falls back to the existing
   adaptive polling** (`liveRefetch.ts`) on disconnect/unsupported. Consumers
   (`LiveTicker`, `FixturesPage`, `StandingsPage`, …) are unchanged — they keep
   reading `['matches']`.
7. **Goal-flash** — reuse the `useRef`-diff pattern from `LiveTicker.tsx:21` to
   detect a score change, then pop/scale + color-flash the changed number and
   pulse the card border. New keyframes inside the existing
   `prefers-reduced-motion: no-preference` block.
8. **`useLiveMinute`** — advances the match clock locally from kickoff +
   last-known minute so it ticks 1′/min instead of jumping on sync.
9. **"⚽ GOAL" banner** — transient in-app toast fired on an SSE goal event.

## Data flow

```
ESPN → live poller (12s) → DynamoDB → API replica diff loop (5s)
     → SSE → EventSource → React Query cache patch → goal-flash / banner
```

Worst case ~20s (was ~90s), typical ~10s. Adaptive polling remains as the
safety net whenever SSE is unavailable.

## Error handling

- **SSE:** EventSource native auto-reconnect + exponential backoff; on hard
  failure, resume adaptive polling with no data gap (shared cache).
- **Poller:** on ESPN error keep last-known state, log, retry next tick (mirrors
  existing `sync.ts` resilience).
- **ETag:** any cache miss falls back to full body.
- **Diff loop:** on Dynamo read error, skip the tick, keep last snapshot.

## Testing (TDD — CI gates deploy on `npm test`)

- **Unit:** extend `matchesRefetchInterval`; ETag 304 logic; SSE diff/event
  emission; minute interpolation; goal-change detection (fires on change, not
  first load).
- **Integration:** `/live` emits on a simulated score change; `/matches` returns
  304 on matching ETag; lean `/live/matches` shape.
- **Frontend:** `useLiveScores` patches cache on event and falls back on error;
  goal-flash fires only on change.

## Deploy plan

Feature branch → PR → `npm test` green → merge to `main` → CI builds images,
bumps `values-dev.yaml`, ArgoCD auto-syncs to dev. The new Deployment and nginx
change ship in the same Helm chart bump. **Do not push to `main` without
explicit user OK** — `main` auto-deploys to the live dev cluster.

## Scope / risk

~15–20 files across `api/`, `web/`, and `infra/`, plus a new long-running
service and a streaming endpoint. Shipped as one PR ("all at once"), so a bug
anywhere blocks the deploy until fixed. Built test-first to keep CI green.

## Out of scope

- Web Push "GOAL" notifications when the app is closed (existing push infra
  could support this later; not in this pass).
- CDN/edge cache provider setup (headers are set; provider wiring is separate).
- Prod deploy (via the separate `promote-to-prod` workflow).
