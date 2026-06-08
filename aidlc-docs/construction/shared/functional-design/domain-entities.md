# Domain Entities — Unit `shared`

Technology-agnostic domain model (realized as TypeScript types + zod schemas in code).

## Enums / value types
- **Stage**: `GROUP_STAGE | LAST_32 | LAST_16 | QUARTER_FINALS | SEMI_FINALS | THIRD_PLACE | FINAL`
- **MatchStatus**: `SCHEDULED | TIMED | IN_PLAY | PAUSED | FINISHED` (provider-aligned)
- **Outcome**: `HOME | DRAW | AWAY`
- **Points**: literal union `0 | 2 | 3 | 5`
- **Score**: `{ home: int 0..30, away: int 0..30 }`

## Entities

### Player
| Field | Type | Notes |
|---|---|---|
| id | string (uuid) | identity key (no auth) |
| name | string (1..30) | display name |
| createdAt | ISO datetime | |

### Group
| Field | Type | Notes |
|---|---|---|
| id | string (uuid) | |
| name | string (1..40) | |
| inviteCode | string | short, unguessable (e.g. 8 chars base32, no ambiguous chars) |
| createdBy | playerId | |
| createdAt | ISO datetime | |

### Membership
| Field | Type | Notes |
|---|---|---|
| groupId | string | |
| playerId | string | |
| joinedAt | ISO datetime | |

### Match
| Field | Type | Notes |
|---|---|---|
| id | string | provider match id |
| stage | Stage | |
| groupName | string? | `A`..`L` for group stage, else null |
| matchday | int? | |
| homeTeam | string | resolved name or placeholder ("Winner Group A") |
| homeCode | string? | 3-letter code (flags) |
| awayTeam | string | |
| awayCode | string? | |
| kickoff | ISO datetime (UTC) | authoritative lock time |
| status | MatchStatus | |
| homeScore | int? | full-time goals; null until played |
| awayScore | int? | |
| placeholder | boolean | true when teams not yet determined (US-3.3) |

### Prediction
| Field | Type | Notes |
|---|---|---|
| playerId | string | owner (identity) |
| matchId | string | |
| home | int 0..30 | predicted home goals |
| away | int 0..30 | predicted away goals |
| points | Points | precomputed on result (default 0) |
| createdAt / updatedAt | ISO datetime | |

### StandingAgg (derived, for leaderboard)
| Field | Type | Notes |
|---|---|---|
| playerId | string | |
| name | string | for final alphabetical tie-break |
| points | int | sum of prediction.points |
| exacts | int | count of predictions scoring 5 |
| correctResults | int | count of predictions scoring >= 2 |

## Relationships
- Player 1—N Membership N—1 Group (many-to-many via Membership).
- Player 1—N Prediction N—1 Match.
- Match results drive Prediction.points.
