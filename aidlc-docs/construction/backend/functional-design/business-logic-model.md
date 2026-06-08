# Business Logic Model — Unit `backend`

## REST API surface (REST/JSON)
| Method | Path | Auth | Purpose | Stories |
|---|---|---|---|---|
| POST | `/auth/login` | none (rate-limited) | login-or-signup with name+PIN → `{ playerId, name, token }` | US-1.1, US-1.2 |
| POST | `/players/me/name` | token | rename self | US-1.3 |
| GET | `/players/me` | token | current player profile | US-1.2 |
| POST | `/groups` | token | create group (+ invite code) | US-2.1 |
| POST | `/groups/join` | token | join by `{ inviteCode }` | US-2.2 |
| GET | `/groups` | token | my groups | US-2.3 |
| GET | `/groups/:id` | token (member) | group detail | US-2.4 |
| GET | `/groups/:id/members` | token (member) | members | US-2.4 |
| GET | `/groups/:id/leaderboard` | token (member) | ranked standings | US-5.3, US-5.4 |
| GET | `/groups/:id/players/:pid/breakdown` | token (member) | per-match breakdown | US-5.5 |
| GET | `/groups/:id/matches/:mid/predictions` | token (member) | pre/post-lock visibility | US-6.1, US-6.2 |
| GET | `/matches` | token | all fixtures (status + locked flag) | US-3.1, US-3.2, US-3.3 |
| GET | `/predictions/me` | token | my predictions | US-4.x |
| PUT | `/predictions/:matchId` | token | upsert prediction (lock+validate) | US-4.1–US-4.4 |

(Internal, not HTTP-routed publicly: `syncService.sync()` invoked by schedule/manual trigger.)

## Key flows (pseudocode)

### Login (AR-1..AR-6)
```
POST /auth/login {name, pin}
  rateLimit(by ip + nameKey)                 # AR-4
  validate name(1..30), pin(^\d{4}$)         # SECURITY-05
  nameKey = lower(trim(name))
  player = PlayerRepo.getByNameKey(nameKey)
  if !player:
     player = create { id=uuid, name, nameKey, pinHash=scrypt(pin) }  # conditional put (AR-6)
  else:
     if !scryptVerify(pin, player.pinHash):
        player.failedLogins++ ; return 401 "Unauthorized"            # AR-2 (generic)
  token = signSession(player.id)             # AR-5
  return { playerId: player.id, name: player.name, token }
```

### Upsert prediction (LR, OR-2)
```
PUT /predictions/:matchId {home, away}
  callerId = requireSession(req)             # OR-1
  validate score (shared schema)             # LR-3
  match = MatchRepo.get(matchId) or 404
  if serverNow() >= match.kickoff: 409 LockedError    # LR-1/LR-2
  PredictionRepo.put({ playerId: callerId, matchId, home, away, points:0 })  # OR-2
  return prediction
```

### Match predictions visibility (VR)
```
GET /groups/:id/matches/:mid/predictions
  callerId = requireSession
  GroupService.assertMember(callerId, id)    # OR-3
  match = MatchRepo.get(mid)
  if serverNow() < match.kickoff:            # VR-1
     return [ my own prediction if any ]
  members = MembershipRepo.listMembersOf(id) # VR-2
  preds = PredictionRepo.listByMatch(mid) ∩ members
  return preds + actual score + per-player points
```

### Leaderboard (US-5.3/5.4)
```
GET /groups/:id/leaderboard
  assertMember
  members = listMembersOf(id)
  agg[player] = { points: Σ pred.points, exacts: #(points==5), correctResults: #(points>=2), name }
  return agg sorted by shared.compareStandings
```

### Sync + scoring (SR)
```
syncService.sync():                          # schedule every 10 min (SR-2)
  raw = footballApiClient.fetchCompetitionMatches()   # token from secret (SR-1)
  for pm in raw:
     m = mapToDomain(pm)                      # stage/group/placeholder/kickoff/status/scores (SR-3)
     prev = MatchRepo.get(m.id)
     MatchRepo.put(m)
     if becameFinishedOrScoreChanged(prev, m):
        scoringService.scoreMatch(m.id)       # points = computePoints(pred, actual) (SR-4)
  on error: log + keep last-known + SyncReport.errors (SR-5)
```

## PBT-01 Testable Properties (Partial: PBT-02 enforced here)
- **RT (PBT-02)**: DynamoDB item ⇄ domain object round-trips for Player (minus pinHash echo), Group, Match, Prediction — `fromItem(toItem(x)) == x`.
- **RT (PBT-02)**: session token round-trip — `verify(sign(playerId)) == playerId` for generated ids; tampered token → reject.
- Scoring invariants already covered in `shared` (no duplication); backend adds an oracle-style check that `scoreMatch` persists exactly `computePoints` for each prediction (example-based + small PBT).
- Advisory: idempotency of `sync` (PBT-04, advisory in Partial mode) — running sync twice on the same provider data yields the same stored state.

## Security cross-cutting (recap, enforced in NFR Design)
Headers (SECURITY-04), CORS allowlist (SECURITY-08), structured logging w/o secrets (SECURITY-03), rate limiting (SECURITY-11/AR-4), generic errors (SECURITY-09), global error handler + fail-closed (SECURITY-15), secrets from config (SECURITY-12).
