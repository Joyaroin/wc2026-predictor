# Component Methods — WC2026 Predictor

Method signatures + high-level purpose + I/O types. **Business rules are deferred to Functional Design.**
Types (e.g., `Player`, `Group`, `Match`, `Prediction`, `Points`) come from `packages/shared`.

Conventions: all service methods are async; `callerId` is the resolved player ID from the identity layer; methods throw typed errors (`NotFoundError`, `ForbiddenError`, `ValidationError`, `LockedError`) handled by `C-ErrorHandler`.

---

## C-SHARED-Scoring (pure)
```ts
type Score = { home: number; away: number };
type Outcome = 'HOME' | 'DRAW' | 'AWAY';
type Points = 0 | 2 | 3 | 5;

function outcomeOf(s: Score): Outcome;
function computePoints(prediction: Score, actual: Score): Points;     // 5/3/2/0
// tie-break comparator inputs are aggregates, not single matches:
function compareStandings(a: StandingAgg, b: StandingAgg): number;    // points, then exacts, then correctResults
```

## C-PlayerService
```ts
createPlayer(name: string): Promise<Player>;                  // validates name (1..30)
getPlayer(playerId: string): Promise<Player>;                // NotFound if absent
renamePlayer(callerId: string, name: string): Promise<Player>; // caller renames self only
```

## C-GroupService
```ts
createGroup(callerId: string, name: string): Promise<Group>;          // generates unguessable invite code, adds caller as member
joinGroup(callerId: string, inviteCode: string): Promise<Group>;      // idempotent; NotFound on bad code
listGroupsForPlayer(callerId: string): Promise<GroupSummary[]>;       // { id, name, memberCount }
getGroup(callerId: string, groupId: string): Promise<GroupDetail>;    // Forbidden if caller not a member
listMembers(callerId: string, groupId: string): Promise<Player[]>;    // members only
assertMember(callerId: string, groupId: string): Promise<void>;       // authorization helper (SECURITY-08)
```

## C-MatchService
```ts
listMatches(): Promise<Match[]>;                              // all 104, with status + lock state
getMatch(matchId: string): Promise<Match>;
isLocked(match: Match, now: Date): boolean;                   // now >= kickoff (server clock)
upsertMatches(matches: Match[]): Promise<void>;              // used by sync; not a public route
```

## C-PredictionService
```ts
upsertPrediction(callerId: string, matchId: string, score: Score): Promise<Prediction>;
  // enforces: ownership (caller==owner), match exists, NOT locked (else LockedError), valid score
getMyPredictions(callerId: string): Promise<Prediction[]>;
getMatchPredictions(callerId: string, groupId: string, matchId: string): Promise<PredictionView[]>;
  // members only; pre-lock returns only caller's own; post-lock returns all members' (US-6.1)
```

## C-ScoringService
```ts
scoreMatch(matchId: string): Promise<void>;                  // for each prediction of a finished match: store computePoints(...)
rescoreMatch(matchId: string): Promise<void>;               // recompute after a corrected result (audit logged)
```

## C-LeaderboardService
```ts
getLeaderboard(callerId: string, groupId: string): Promise<LeaderboardRow[]>;
  // members only; sums stored points per member; orders via compareStandings (points, exacts, correctResults)
getBreakdown(callerId: string, groupId: string, targetPlayerId: string): Promise<BreakdownRow[]>;
  // per-match prediction/actual/points (own always; others only for locked/finished matches)
```

## C-FootballApiClient
```ts
fetchCompetitionMatches(): Promise<ProviderMatch[]>;         // GET competition matches; uses secret API key
mapToDomain(p: ProviderMatch): Match;                        // provider payload -> domain Match (+ stage/group/placeholders)
```

## C-SyncService
```ts
sync(): Promise<SyncReport>;                                 // fetch -> mapToDomain -> upsertMatches -> rescore finished matches
  // resilient: on provider failure, keep last-known data and log (NFR-5.1)
```

## C-Repository (DynamoDB single-table access)
```ts
// PlayerRepo
putPlayer(p: Player): Promise<void>;  getPlayer(id): Promise<Player|null>;
// GroupRepo
putGroup(g: Group): Promise<void>;  getGroup(id): Promise<Group|null>;  getByInviteCode(code): Promise<Group|null>;
// MembershipRepo
addMember(groupId, playerId): Promise<void>;  listGroupsOf(playerId): Promise<string[]>;  listMembersOf(groupId): Promise<string[]>;  isMember(groupId, playerId): Promise<boolean>;
// MatchRepo
putMatch(m: Match): Promise<void>;  getMatch(id): Promise<Match|null>;  listMatches(): Promise<Match[]>;
// PredictionRepo
putPrediction(p: Prediction): Promise<void>;  getPrediction(playerId, matchId): Promise<Prediction|null>;
  listByMatch(matchId): Promise<Prediction[]>;  listByPlayer(playerId): Promise<Prediction[]>;
```

## Cross-cutting (HTTP)
```ts
// C-Validation: zod schemas per route -> ValidationError on failure
// C-Identity: requirePlayer(req): string   // reads X-Player-Id header, validates format
// C-Authorization: built on GroupService.assertMember + ownership checks in PredictionService
// C-ErrorHandler: errorMiddleware(err, req, res, next)  // maps typed errors -> status + generic body
// C-Logger: log.info/warn/error({ requestId, ... })
// C-RateLimiter: rateLimit(opts) middleware
// C-Config: loadConfig(): { tableName, apiKey, allowedOrigin, competition }  // throws if required missing
```

## Frontend
```ts
// C-ApiClient (typed wrappers around the REST endpoints)
api.createPlayer(name) ; api.renamePlayer(name)
api.createGroup(name) ; api.joinGroup(code) ; api.listMyGroups() ; api.getGroup(id) ; api.listMembers(id)
api.listMatches()
api.upsertPrediction(matchId, score) ; api.getMyPredictions() ; api.getMatchPredictions(groupId, matchId)
api.getLeaderboard(groupId) ; api.getBreakdown(groupId, playerId)
// C-PlayerContext: usePlayer() -> { player, setName, clear }
```
