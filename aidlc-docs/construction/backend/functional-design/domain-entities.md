# Backend Domain Entities & Data Model — Unit `backend`

Builds on `shared` types. Adds persistence-facing fields (PIN hash, name index) and the DynamoDB single-table key design.

## Entity additions vs `shared`
### Player (persisted)
| Field | Type | Notes |
|---|---|---|
| id | uuid | internal id (never exposed to other players) |
| name | string (1..30) | **unique** display name |
| nameKey | string | `lower(trim(name))` — uniqueness key |
| pinHash | string | scrypt hash `salt:derived` (SECURITY-12); PIN never stored/logged |
| failedLogins | int | rolling counter for rate-limit/backoff |
| createdAt / updatedAt | ISO | |

### Session (stateless, not stored)
- Signed token (HMAC-SHA256) `base64url(header).base64url(payload).sig` where payload = `{ sub: playerId, iat, exp }`.
- Signing key from config secret. Default TTL 30 days (casual game). Validated per request (signature + exp).

## DynamoDB single-table design
Table `wc2026` with primary key `PK` (partition) + `SK` (sort), and GSIs.

| Entity | PK | SK | Attributes |
|---|---|---|---|
| Player | `PLAYER#<id>` | `PROFILE` | name, nameKey, pinHash, failedLogins, timestamps |
| Player name index | (GSI1) `NAME#<nameKey>` | `PLAYER#<id>` | for unique-name lookup at login |
| Group | `GROUP#<id>` | `META` | name, inviteCode, createdBy, createdAt |
| Group code index | (GSI1) `CODE#<inviteCode>` | `GROUP#<id>` | join-by-code lookup |
| Membership | `GROUP#<id>` | `MEMBER#<playerId>` | joinedAt |
| Membership (by player) | (GSI1) `PLAYER#<playerId>` | `GROUP#<id>` | list a player's groups |
| Match | `MATCH#<id>` | `META` | stage, groupName, teams, kickoff, status, scores, placeholder |
| Match (by schedule) | (GSI2) `SCHEDULE` | `<kickoffIso>#<id>` | list/order all matches by kickoff |
| Prediction | `PLAYER#<playerId>` | `PRED#<matchId>` | home, away, points, timestamps |
| Prediction (by match) | (GSI1) `MATCH#<matchId>` | `PLAYER#<playerId>` | all predictions for a match |

**GSI1** = generic inverted/lookup index (PK=`GSI1PK`, SK=`GSI1SK`). **GSI2** = schedule index for listing matches.

### Access patterns covered
- Login: get player by `NAME#<nameKey>` (GSI1) → verify pinHash.
- Get player by id; list player's groups (GSI1 `PLAYER#<id>`).
- Group by id; group by invite code (GSI1 `CODE#`); list members (`GROUP#<id>` + `MEMBER#`).
- List all matches ordered by kickoff (GSI2 `SCHEDULE`).
- Player's predictions (`PLAYER#<id>` + `PRED#`); a match's predictions (GSI1 `MATCH#<id>`).

## Notes
- Encryption at rest via DynamoDB default (SECURITY-01) — configured in `infra`.
- No PII beyond a chosen display name; PIN only as hash.
