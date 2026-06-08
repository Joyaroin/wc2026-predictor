# Component Dependencies — WC2026 Predictor

## Dependency matrix (→ means "depends on / calls")

| Component | Depends on |
|---|---|
| P-* (frontend pages) | C-ApiClient, C-PlayerContext, C-QueryProvider, U-* |
| C-ApiClient | C-SHARED-Types |
| C-PlayerContext | C-ApiClient, browser localStorage |
| C-HttpApp | all controllers, C-Validation, C-Identity, C-Authorization, C-ErrorHandler, C-Logger, C-RateLimiter |
| PlayerService | PlayerRepo |
| GroupService | GroupRepo, MembershipRepo |
| MatchService | MatchRepo |
| PredictionService | PredictionRepo, MatchService, GroupService |
| LeaderboardService | PredictionRepo, MembershipRepo, C-SHARED-Scoring |
| ScoringService | PredictionRepo, MatchRepo, C-SHARED-Scoring |
| SyncService | C-FootballApiClient, MatchRepo, ScoringService, C-Config, C-Logger |
| C-FootballApiClient | C-Config (secret API key), C-Logger |
| *Repo (Player/Group/Membership/Match/Prediction) | DynamoDB (AWS SDK), C-Config (table name) |
| C-SHARED-Scoring | (none — pure) |
| C-SHARED-Types | (none) |

**Acyclic check**: dependencies flow web → api(controllers → services → repos → DynamoDB); services depend on pure `C-SHARED-Scoring` only. No cycles.

## Communication patterns
- **Frontend ↔ Backend**: HTTPS REST/JSON; player identity via `X-Player-Id` header; CORS restricted to the SPA origin.
- **Backend ↔ DynamoDB**: AWS SDK (single-table design with GSIs), TLS, least-privilege IAM.
- **Backend ↔ Football API**: outbound HTTPS with secret key; interval-based (not per-request) to respect rate limits.
- **Scheduler ↔ Sync**: EventBridge rule invokes the Sync Lambda on an interval.

## Data flow (text diagram)
```
[ React SPA (S3/CloudFront) ]
        | HTTPS REST (+X-Player-Id)
        v
[ API Gateway ] --> [ API Lambda: Express app ]
                          | services
                          v
                    [ DynamoDB single table ]
                          ^
                          | writes matches + points
[ EventBridge schedule ] -> [ Sync Lambda ] --HTTPS--> [ Football API ]
                                   |
                                   +--> reads secret API key from [ Secrets Manager ]
        logs/metrics from all Lambdas -> [ CloudWatch ]
```

## Single-table DynamoDB key sketch (refined in Functional/Infra Design)
| Entity | PK | SK | GSI1 (PK/SK) |
|---|---|---|---|
| Player | `PLAYER#<id>` | `PROFILE` | — |
| Group | `GROUP#<id>` | `META` | `CODE#<inviteCode>` / `GROUP#<id>` (lookup by code) |
| Membership | `GROUP#<id>` | `MEMBER#<playerId>` | `PLAYER#<playerId>` / `GROUP#<id>` (player's groups) |
| Match | `MATCH#<id>` | `META` | `STAGE#<stage>` / `KICKOFF#<iso>` (list/order) |
| Prediction | `PLAYER#<playerId>` | `PRED#<matchId>` | `MATCH#<matchId>` / `PLAYER#<playerId>` (by match) |
