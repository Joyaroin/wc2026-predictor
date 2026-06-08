# Services & Orchestration — WC2026 Predictor

The REST API exposes thin controllers that delegate to domain services. Services orchestrate repositories and the scoring engine. Two execution contexts: **request/response** (API Gateway → Lambda → Express) and **scheduled job** (EventBridge → Sync Lambda).

---

## Service catalog

| Service | Type | Orchestrates | Notes |
|---|---|---|---|
| PlayerService | Request | PlayerRepo | Identity without auth |
| GroupService | Request | GroupRepo, MembershipRepo | Invite-code generation + membership authorization |
| MatchService | Request | MatchRepo | Read fixtures; compute lock state from server clock |
| PredictionService | Request | PredictionRepo, MatchService, GroupService | Lock + ownership enforcement; pre/post-lock visibility |
| LeaderboardService | Request | PredictionRepo, MembershipRepo, Scoring | Aggregates stored points; tie-breakers |
| ScoringService | Job/Internal | PredictionRepo, MatchRepo, SHARED-Scoring | Precompute & persist points on result |
| SyncService | Job | FootballApiClient, MatchRepo, ScoringService | Ingest fixtures/results; trigger rescoring |

---

## Key orchestration flows

### Flow 1 — Save a prediction (US-4.1/4.2/4.3)
```
Client -> POST /predictions {matchId, score}
  C-Identity.requirePlayer -> callerId
  C-Validation (score bounds)
  PredictionService.upsertPrediction(callerId, matchId, score)
     -> MatchService.getMatch + isLocked(now)   // LockedError if kickoff passed
     -> PredictionRepo.putPrediction (keyed by callerId+matchId -> ownership guaranteed)
  -> 200 Prediction
```

### Flow 2 — View a match's predictions (US-6.1)
```
Client -> GET /groups/:groupId/matches/:matchId/predictions
  callerId = requirePlayer
  GroupService.assertMember(callerId, groupId)        // SECURITY-08
  match = MatchService.getMatch(matchId)
  if !isLocked(match): return [caller's own prediction only]
  else: PredictionRepo.listByMatch -> filter to group members -> return all
```

### Flow 3 — Leaderboard (US-5.3/5.4)
```
Client -> GET /groups/:groupId/leaderboard
  assertMember
  members = MembershipRepo.listMembersOf(groupId)
  for each member: sum stored points (PredictionRepo.listByPlayer) -> StandingAgg{points, exacts, correctResults}
  sort with SHARED-Scoring.compareStandings
  -> LeaderboardRow[]
```

### Flow 4 — Scheduled sync + scoring (US-3.4/5.2)
```
EventBridge (interval) -> Sync Lambda
  SyncService.sync():
    providerMatches = FootballApiClient.fetchCompetitionMatches()   // uses secret key; rate-limited
    domain = map provider -> Match (stage, group, placeholders)
    MatchRepo.putMatch(...) for changed matches
    for each newly-finished/corrected match:
       ScoringService.scoreMatch(matchId):
         preds = PredictionRepo.listByMatch
         for p: p.points = SHARED-Scoring.computePoints(p.score, actual); PredictionRepo.putPrediction(p)
    return SyncReport (counts, errors)   // failures logged, last-known data preserved
```

---

## Cross-cutting middleware order (request pipeline)
```
helmet/security-headers (SECURITY-04)
 -> cors(allowedOrigin only) (SECURITY-08)
 -> request-id + logger (SECURITY-03)
 -> rate limiter (SECURITY-11)
 -> body size limit + json parse (SECURITY-05)
 -> identity (X-Player-Id)
 -> route handler (validation -> service)
 -> global error handler (SECURITY-09/15)
```

## Security & PBT notes (Application Design stage)
- **SECURITY-08** is realized in GroupService.assertMember + PredictionService ownership/visibility — not scattered (SECURITY-11 separation of concerns).
- **SECURITY-12** credential clause: API key only ever read by C-Config/FootballApiClient from a secret; never returned by any service.
- **PBT** anchor: SHARED-Scoring is isolated and pure → directly testable (PBT-02/03/07/08), framework fast-check (PBT-09, finalized in NFR Requirements).
