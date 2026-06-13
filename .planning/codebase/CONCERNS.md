# Codebase Concerns

**Analysis Date:** 2026-06-13

---

## Tech Debt

**Awards lock date hardcoded in shared package:**
- Issue: `AWARDS_LOCK_ISO = '2026-06-13T18:00:00Z'` is a compile-time constant with no override mechanism
- Files: `packages/shared/src/awards.ts`
- Impact: Any lock-date change requires a full rebuild and redeploy of both `api` and `web`; the lock date has already passed as of today, meaning all award picks are permanently locked
- Fix approach: Move the lock date to a config/environment variable read at runtime, or expose an admin endpoint to override it; the shared function signature `awardsLocked(now: Date): boolean` is clean — only the constant needs to become injectable

**Hardcoded admin player name default:**
- Issue: `adminPlayer: (env.ADMIN_PLAYER ?? 'adham').trim().toLowerCase()` bakes a specific username as fallback
- Files: `api/src/lib/config.ts:43`
- Impact: If `ADMIN_PLAYER` env var is not set in a new environment, a player named "adham" automatically gains admin access to the feedback inbox; surprising and potentially insecure
- Fix approach: Default to empty string (disabled) rather than a specific name; document the variable as required for admin access

**Module-level mutable state in GoldenBootService:**
- Issue: `let pool: WcPlayer[] = []` and `let poolAt = 0` are closure-level singletons inside `createGoldenBootService`; shared across all requests from a single process
- Files: `api/src/services/goldenBoot.ts:57-58`
- Impact: The in-memory pool cache is process-local, meaning it is lost on pod restart and not shared across API replicas (when HPA scales to >1). Multiple concurrent requests arriving at the same moment could trigger redundant ESPN fetches before the cache is populated (no mutex/deduplication guard)
- Fix approach: Promote the cache to a short-lived DynamoDB item or accept the duplicate fetch risk since the TTL is 6 hours and the API is currently single-replica

**Invite code uniqueness retry via sequential reads:**
- Issue: `uniqueInviteCode()` checks each candidate code with a DynamoDB `GetCommand` in a serial loop (up to 5 attempts)
- Files: `api/src/services/groups.ts:31-37`
- Impact: 5 sequential round-trips to DynamoDB on group creation; low probability of collision makes this harmless in practice but wasteful
- Fix approach: Use `ConditionExpression: 'attribute_not_exists(PK)'` on the first put attempt and retry only on collision, similar to how player name uniqueness is handled

**No pagination on group member listing:**
- Issue: `memberships.listMembers(groupId)` returns all members in a single DynamoDB `QueryCommand` with no `Limit` or pagination
- Files: `api/src/repos/dynamo.ts:225-234`
- Impact: Correct for the current scale, but groups with hundreds of members will return large payloads; leaderboard computation then performs N sequential DynamoDB reads per member (see Performance section below)
- Fix approach: Add a reasonable `Limit` and paginate, or accept the current design constraint that groups are small (<100 members)

---

## Known Bugs

**PIN inputs are not masked on the login page:**
- Symptoms: The PIN `<input>` on `LandingPage.tsx` uses `inputMode="numeric"` and no `type` attribute (defaults to `type="text"`), so the PIN is visible in plaintext as the user types; same applies to all three PIN inputs in `SettingsPage.tsx`
- Files: `web/src/pages/LandingPage.tsx:45-51`, `web/src/pages/SettingsPage.tsx:124-132`
- Trigger: Any device with a screen observer (over-the-shoulder, screen recording) sees the PIN in the clear
- Workaround: None currently; intended placeholder `••••` text gives a false impression of masking

**ESPN team-name reconciliation may silently drop first-goal facts for unaliased teams:**
- Symptoms: If a team name in the ESPN scoreboard response does not exactly match the football-data.org name after `normalize()`, and no `ALIAS` entry covers it, `teamsMatch()` returns false and the first-goal fact is silently skipped; no log warning is emitted
- Files: `api/src/services/espnFacts.ts:43-46`, `api/src/services/espnFacts.ts:15-27`
- Trigger: A team with a name discrepancy between the two providers (e.g. "Ivory Coast" vs "Cote d'Ivoire" variants not in `ALIAS`)
- Workaround: Manually add the alias to `ALIAS`; affected matches will back-fill on the next successful ingest once the alias is deployed

**`scryptSync` called synchronously during login and PIN change:**
- Symptoms: `hashPin` and `verifyPin` call `scryptSync` on the Node.js event loop; under the default scrypt parameters Node uses (N=16384), each call blocks the event loop for ~50-100ms
- Files: `api/src/lib/pin.ts:8,17`
- Trigger: Concurrent login or PIN-change requests amplify the blocking window
- Workaround: The `loginLimiter` (10 req/min) reduces concurrency in practice; acceptable at current scale

---

## Security Considerations

**Auth token stored in `localStorage` (XSS-accessible):**
- Risk: The session JWT is persisted to `localStorage` under key `wc2026.player`; any XSS vulnerability exposes the token to exfiltration
- Files: `web/src/context/PlayerContext.tsx:43,58`
- Current mitigation: `helmet()` sets security headers including `Content-Security-Policy` (default helmet config); CORS is origin-restricted; the app has no eval/dangerouslySetInnerHTML usage visible in reviewed files
- Recommendations: Consider `httpOnly` cookie storage instead; at minimum, ensure a strict CSP `script-src` is configured in the helmet call

**No server-side token revocation:**
- Risk: Tokens are stateless HMAC-signed JWTs with a 30-day TTL; there is no revocation list or server-side session store; compromised tokens are valid until expiry
- Files: `api/src/lib/token.ts`, `api/src/lib/config.ts:40`
- Current mitigation: Session TTL is configurable; the signing secret rotation would invalidate all sessions
- Recommendations: For a low-stakes app this is acceptable; document the "rotate `SESSION_SIGNING_SECRET` to invalidate all sessions" procedure

**Admin token sent in plain HTTP headers:**
- Risk: The `X-Admin-Token` header is used to gate `POST /admin/player-of-tournament` and `GET /admin/feedback`; if TLS terminates outside the cluster (or during development without TLS), the token is exposed in transit
- Files: `api/src/routes/index.ts:103,111`
- Current mitigation: Production ingress has TLS enabled via cert-manager
- Recommendations: Add a log warning if `adminToken` is non-empty and `ALLOWED_ORIGIN` is an HTTP (not HTTPS) origin

**Rate limiters use in-memory store (not distributed):**
- Risk: `express-rate-limit` defaults to an in-memory counter store; with HPA enabled and multiple API pods, each pod maintains independent counters, effectively multiplying the rate limit by the number of replicas (e.g., 4 pods × 10 login/min = 40 login attempts/min)
- Files: `api/src/middleware/index.ts:58-60`
- Current mitigation: `values.yaml` defaults to 1 replica; HPA is disabled by default
- Recommendations: If HPA is enabled, add a shared store (e.g., `rate-limit-redis` or DynamoDB-backed store) for the `loginLimiter` and `joinLimiter`; the `globalLimiter` is less critical

**Route params not length/format validated before DB lookup:**
- Risk: Path parameters like `:id` (group id), `:matchId`, `:pid` are passed directly to DynamoDB key lookups without format validation
- Files: `api/src/routes/index.ts:73-90`
- Current mitigation: DynamoDB will simply return null for non-existent keys, resulting in a clean 404 or 403; no injection risk because keys are passed as attribute values, not expressions
- Recommendations: Low risk; adding a `z.string().uuid()` validation middleware for params that expect UUIDs would provide defence-in-depth

---

## Performance Bottlenecks

**Group leaderboard: N×6 sequential DynamoDB reads per member:**
- Problem: `getLeaderboard()` fetches 6 items per group member sequentially (player profile, bracket list, golden boot, dark horse, tournament winner, POTT, predictions)
- Files: `api/src/services/leaderboard.ts:47-64`
- Cause: `for (const id of memberIds)` with 6 awaited calls inside the loop; 20 members = 120+ DynamoDB round-trips
- Improvement path: Parallelize within each member using `Promise.all([...])`, then parallelize across members with `Promise.all(memberIds.map(...))`; overall latency would drop from O(N×6) to O(6) DynamoDB latency

**Global leaderboard: 6 full table scans per request:**
- Problem: `getGlobal()` calls `predictions.scanAll()`, `bracket.scanAll()`, `goldenBoot.scanAll()`, `darkHorse.scanAll()`, `tournamentWinner.scanAll()`, and `pott.scanAll()` — six separate scans of the entire table per request
- Files: `api/src/services/leaderboard.ts:66-98`, `api/src/repos/dynamo.ts:68-79`
- Cause: Single-table design without a dedicated leaderboard projection; scans are paginated but still costly in RCUs
- Improvement path: Pre-compute and cache the global leaderboard on every sync run and store as a single DynamoDB item; invalidate on prediction writes. The current approach is sustainable only at low traffic (<100 players)

**Group membership deletion is sequential per-item:**
- Problem: `removeAll(groupId)` queries all member items then deletes each with a separate `DeleteCommand` in sequence
- Files: `api/src/repos/dynamo.ts:251-264`
- Cause: No `BatchWriteCommand` or `TransactWriteCommand` (limited to 25 items) is used
- Improvement path: Replace with `BatchWriteCommand` batched in chunks of 25

**Match sync: sequential `getById` before every upsert:**
- Problem: During sync, `matches.getById(next.id)` is called for every match in the fetched list before upserting; a full WC schedule (104 matches) generates 104 sequential DynamoDB `GetCommand` calls before any write
- Files: `api/src/services/sync.ts:52-53`
- Cause: Diffing prev vs next state to detect score changes requires reading the current record first
- Improvement path: Batch-fetch all match IDs up front via a single `QueryCommand` on the GSI2 `SCHEDULE` projection, build a map, then iterate

---

## Fragile Areas

**ESPN unofficial API dependency:**
- Files: `api/src/integration/espnClient.ts`
- Why fragile: Relies on `site.api.espn.com` undocumented public endpoints with no authentication, rate-limit headers, or SLA; the response shape is typed loosely as `{ [k: string]: unknown }` and parsed with a recursive `get()` helper
- Safe modification: All ESPN calls are wrapped in try/catch and fail-soft; first-goal bonuses and golden boot tallies will be stale but the core prediction/leaderboard flow is unaffected; keep changes to `espnClient.ts` tightly isolated
- Test coverage: `api/test/services/espnFacts.test.ts` covers the fact ingestion logic; no test covers a changed ESPN response schema

**Team-name alias list (`ALIAS`) is manually maintained:**
- Files: `api/src/services/espnFacts.ts:18-27`
- Why fragile: New country name discrepancies (e.g., political renames, provider updates) silently cause `teamsMatch()` to return false with no observable error
- Safe modification: Add a log warning when `teamsMatch` fails to resolve a fact to any stored match; monitor for unresolved facts in production logs

**`darkHorseScore` relies on static `teamWinProbability` table:**
- Files: `packages/shared/src/darkHorse.ts` (inferred from `teamWinProbability` import in `darkHorse.ts`)
- Why fragile: Pre-tournament win probabilities are baked at build time; cannot be updated mid-tournament without a deployment
- Safe modification: Read-only; the scoring formula uses it as input weight — do not change values mid-tournament as it would retroactively alter standings

---

## Scaling Limits

**In-memory player pool cache (GoldenBootService) is not shared across replicas:**
- Current capacity: Works correctly with a single API pod
- Limit: With 2+ replicas each pod independently caches the ESPN player pool; on pod restart the pool is cold for up to 6 hours; concurrent requests during the cold period all hit ESPN simultaneously
- Scaling path: Store the pool in DynamoDB with a TTL attribute, or use the existing `stats` table as a lightweight cache

**Rate limiting is per-pod:**
- Current capacity: Effective at 1 API replica
- Limit: With HPA scaling to `maxReplicas: 4`, effective rate limits multiply by the number of pods
- Scaling path: Add a shared counter store for `loginLimiter` before enabling HPA

---

## Dependencies at Risk

**ESPN unofficial API (`site.api.espn.com`):**
- Risk: Undocumented, unauthenticated endpoint; could be blocked, rate-limited, or schema-changed without notice at any time during the tournament
- Impact: First-goal team/scorer bonuses would stop updating; golden boot leader tally would become stale; core match predictions/leaderboard continue working
- Migration plan: Fall back to manual admin entry endpoints if ESPN goes down; the `firstGoalTeam`/`firstScorerId` fields are nullable so the app degrades gracefully

**`@codegenie/serverless-express` present but not in active use (apparent):**
- Risk: Serverless adapter dependency is present in `api/package.json` but no Lambda handler is visible in the reviewed source tree
- Impact: Carries unnecessary bundle weight; dependency surface grows without benefit
- Migration plan: Remove if no serverless deployment path is intended; verify against `api/scripts/` directory for any bundling scripts that reference it

---

## Test Coverage Gaps

**Frontend (web) has only one test file:**
- What's not tested: All React pages (FixturesPage, GroupsPage, SettingsPage, etc.), the optimistic update logic in mutations, the MatchCard component, PlayerContext login/logout flows
- Files: `web/src/pages/`, `web/src/components/MatchCard.tsx`, `web/src/context/PlayerContext.tsx`
- Risk: UI regressions in prediction entry, joker placement, first-scorer selection, and optimistic rollback go undetected until manual testing
- Priority: High — MatchCard and FixturesPage contain the most complex client-side state logic

**DynamoDB repository layer has no live integration tests:**
- What's not tested: `createDynamoRepositories` in `api/src/repos/dynamo.ts` is only exercised indirectly through integration flow tests that run against the `memory` repository; the DynamoDB mapper tests (`mappers.pbt.test.ts`) verify round-trip serialization but not the actual DynamoDB interactions (conditional writes, GSI queries, pagination of `scanItems`)
- Files: `api/src/repos/dynamo.ts`
- Risk: DynamoDB-specific bugs (e.g., pagination edge cases in `scanItems`, conditional expression failures) are not caught until production
- Priority: Medium — DynamoDB-Local is available in the infrastructure layer and could be used for a local integration test suite

**PIN masking / input type not tested:**
- What's not tested: There is no test asserting `type="password"` on PIN inputs
- Files: `web/src/pages/LandingPage.tsx`, `web/src/pages/SettingsPage.tsx`
- Risk: The current `type="text"` (visible PIN) will persist undetected
- Priority: High (security-adjacent UX issue)

---

*Concerns audit: 2026-06-13*
