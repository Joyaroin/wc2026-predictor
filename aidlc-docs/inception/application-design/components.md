# Components — WC2026 Predictor

High-level component identification. Detailed business rules are deferred to Functional Design (CONSTRUCTION).

Decisions: REST/JSON API · TypeScript everywhere · TanStack Query on the frontend · points precomputed on result sync · monorepo (`web/`, `api/`, `infra/`, `packages/shared`).

---

## A. Shared (`packages/shared`)

### C-SHARED-Types
- **Purpose**: Single source of truth for domain types shared by API and web.
- **Responsibilities**: Define `Player`, `Group`, `Membership`, `Match`, `Prediction`, `Stage`, `MatchStatus`, scoring result types, and API request/response DTOs.
- **Interface**: Exported TypeScript types/enums + zod schemas for runtime validation reuse.

### C-SHARED-Scoring
- **Purpose**: The pure scoring engine, shared so the web can preview points and the API can authoritatively store them.
- **Responsibilities**: `computePoints(prediction, actual)`, outcome classification, tie-break comparators. Pure, deterministic, no I/O. **Primary PBT target** (PBT-02/03/07/08).
- **Interface**: Pure functions.

---

## B. Backend (`api/`)

### Domain Services
| Component | Purpose | Key Responsibilities |
|---|---|---|
| **C-PlayerService** | Manage name-based identities | Create player, get player, rename; issue/validate player IDs |
| **C-GroupService** | Friend groups & membership | Create group (+ unguessable invite code), join by code, list a player's groups, list members, **membership authorization checks** |
| **C-MatchService** | Tournament fixtures/results | List matches (by stage/date), get match, expose lock state via server clock, upsert match data from sync |
| **C-PredictionService** | Players' predictions | Upsert prediction with **kickoff-lock + ownership** enforcement, get a player's predictions, get a match's predictions (post-lock only) |
| **C-ScoringService** | Apply scoring | Use `C-SHARED-Scoring` to compute & persist points when results arrive; recompute on corrections |
| **C-LeaderboardService** | Standings | Aggregate stored points per group, apply tie-breakers, produce ranked leaderboard + per-player breakdown |

### Integration & Jobs
| Component | Purpose | Key Responsibilities |
|---|---|---|
| **C-FootballApiClient** | External provider adapter | Fetch the WC competition's matches/results; map provider payloads → domain `Match`; respect rate limits; read API key from secret |
| **C-SyncService** | Orchestrate ingestion | Pull fixtures/results via client, persist via repos, trigger `C-ScoringService` recompute; run on schedule/manual trigger; resilient to provider failures |

### Persistence (DynamoDB)
| Component | Purpose | Key Responsibilities |
|---|---|---|
| **C-Repository (single-table)** | Data access | CRUD/query access objects: `PlayerRepo`, `GroupRepo`, `MembershipRepo`, `MatchRepo`, `PredictionRepo` over a single DynamoDB table with GSIs. Encapsulates key design; no business logic |

### Cross-cutting (HTTP layer)
| Component | Purpose | Key Responsibilities |
|---|---|---|
| **C-HttpApp** | Express app (Lambda-adaptable) | Route wiring, runs locally or behind API Gateway via Lambda adapter |
| **C-Validation** | Input validation | zod schemas on every endpoint (types, bounds, formats) — SECURITY-05 |
| **C-Identity** | Lightweight identity | Resolve calling player from a player-ID header; attach to request (no passwords) |
| **C-Authorization** | Object-level access | Enforce membership + ownership (SECURITY-08); hide rivals' predictions pre-lock |
| **C-ErrorHandler** | Safe errors | Global handler; generic client messages, structured server logs (SECURITY-09/15) |
| **C-Logger** | Structured logging | timestamp, request/correlation ID, level, message; no secrets/PII (SECURITY-03) |
| **C-RateLimiter** | Abuse protection | Throttle public endpoints, esp. join-by-code (SECURITY-11) |
| **C-Config** | Config/secrets | Load env/secrets (API key, table name, allowed origin); fail fast if missing (US-7.2) |

---

## C. Frontend (`web/`)

### Infrastructure
| Component | Purpose | Responsibilities |
|---|---|---|
| **C-ApiClient** | Typed REST client | Wrap fetch; send player-ID header; map DTOs from `packages/shared` |
| **C-PlayerContext** | Local identity | Persist player ID/name in localStorage; expose current player |
| **C-QueryProvider** | Server-state | TanStack Query setup: caching, refetch fixtures, optimistic prediction saves |

### Pages / Feature modules
| Component | Purpose | Stories |
|---|---|---|
| **P-Landing** | Name entry / resume | US-1.1, US-1.2, US-1.3 |
| **P-Groups** | List/create/join groups | US-2.1, US-2.2, US-2.3 |
| **P-GroupDetail** | Group leaderboard + members | US-2.4, US-5.3, US-5.4 |
| **P-Fixtures** | Matches by stage/date + predict | US-3.1, US-3.2, US-3.3, US-4.1, US-4.2, US-4.4 |
| **P-MatchDetail** | Everyone's picks vs result | US-6.1, US-6.2 |
| **P-MyBreakdown** | Per-match points + total | US-5.5, US-4.6 |

### Reusable UI
- **U-MatchCard** (status badge + prediction input), **U-PredictionInput**, **U-LeaderboardTable**, **U-StatusBadge** (Open/Locked/Played), **U-PlaceholderTeam**.

---

## D. Infrastructure (`infra/`)
- **C-Infra (IaC)**: Defines AWS resources (Lambda, API Gateway, DynamoDB table + GSIs, S3 + CloudFront for the SPA, IAM least-privilege roles, Secrets Manager entry for the API key, CloudWatch log groups/alarms, EventBridge schedule for sync). Detailed in Infrastructure Design stage.
