# Application Design (Consolidated) — WC2026 Predictor

This document consolidates the Application Design artifacts. See the companion files for detail:
- [components.md](components.md) — component definitions & responsibilities
- [component-methods.md](component-methods.md) — method signatures & I/O
- [services.md](services.md) — service layer & orchestration flows
- [component-dependency.md](component-dependency.md) — dependency matrix & data flow

## Decisions (from application-design-plan.md)
| Topic | Decision |
|---|---|
| API style | REST/JSON over HTTP |
| Language | TypeScript (frontend + backend + shared) |
| Frontend state | TanStack Query for server state + local state |
| Points computation | Precompute & store on result sync |
| Repo structure | Monorepo: `web/`, `api/`, `infra/`, `packages/shared` |

## Architecture at a glance
- **`web/`** — React + TypeScript SPA (TanStack Query), hosted on S3/CloudFront. Pages: Landing, Groups, GroupDetail (leaderboard), Fixtures (predict), MatchDetail, MyBreakdown.
- **`api/`** — Express app (TypeScript) runnable locally and on Lambda via an HTTP adapter. Thin controllers → domain services → DynamoDB repositories. Cross-cutting middleware enforces validation, identity, authorization, logging, rate limiting, security headers, and safe errors.
- **`packages/shared`** — domain types + zod schemas + the **pure scoring engine** (shared by api & web; primary PBT target).
- **`infra/`** — AWS IaC (Lambda, API Gateway, DynamoDB single table + GSIs, S3/CloudFront, IAM least-privilege, Secrets Manager, CloudWatch, EventBridge schedule). Detailed in Infrastructure Design.

## Component summary
- **Domain services**: PlayerService, GroupService, MatchService, PredictionService, ScoringService, LeaderboardService.
- **Integration/jobs**: FootballApiClient, SyncService.
- **Persistence**: single-table DynamoDB repositories (Player/Group/Membership/Match/Prediction).
- **Cross-cutting**: Validation, Identity, Authorization, ErrorHandler, Logger, RateLimiter, Config.
- **Frontend**: ApiClient, PlayerContext, QueryProvider, feature pages, reusable UI.

## Story coverage check
- Identity (US-1.x) → PlayerService + PlayerContext + P-Landing.
- Groups (US-2.x) → GroupService (+ invite codes, membership auth) + P-Groups/P-GroupDetail.
- Fixtures/Results (US-3.x) → MatchService + SyncService + FootballApiClient + P-Fixtures.
- Predictions (US-4.x) → PredictionService (lock+ownership) + U-PredictionInput.
- Scoring/Leaderboards (US-5.x) → SHARED-Scoring + ScoringService + LeaderboardService + P-GroupDetail/P-MyBreakdown.
- Fair play/Match detail (US-6.x) → PredictionService visibility rules + P-MatchDetail.
- Ops/Security (US-7.x) → Config/secret handling, security headers, CORS, logging, rate limiting, safe errors.

## Extension compliance — Application Design stage
**🔒 Security Baseline**
| Rule | Status | Where addressed |
|---|---|---|
| SECURITY-03 logging | Compliant (designed) | C-Logger in middleware pipeline |
| SECURITY-04 headers | Compliant (designed) | security-headers middleware |
| SECURITY-05 input validation | Compliant (designed) | C-Validation (zod) per route |
| SECURITY-08 access control | Compliant (designed) | GroupService.assertMember + PredictionService ownership/visibility |
| SECURITY-09 misconfig/safe errors | Compliant (designed) | C-ErrorHandler generic responses |
| SECURITY-11 secure design / rate limit | Compliant (designed) | isolated scoring/security modules + C-RateLimiter |
| SECURITY-12 credentials (API key) | Compliant (designed) | secret read only by C-Config/FootballApiClient |
| SECURITY-13 data integrity | Compliant (designed) | rescore is auditable; safe JSON mapping |
| SECURITY-15 exception handling | Compliant (designed) | global error handler; fail-closed writes |
| SECURITY-01/02/06/07/10/14 | Deferred | Infrastructure Design / Build & Test (encryption, gateway logging, IAM, network, supply chain, alerting) — N/A to pure app-component design |

No blocking security findings at Application Design.

**🧪 Property-Based Testing (Partial)**
- PBT-01 property identification is **deferred to Functional Design** (next stage) but pre-seeded: SHARED-Scoring is pure and isolated, enabling PBT-02 (round-trip on DTO serialization), PBT-03 (scoring invariants), PBT-07 (domain generators), PBT-08 (shrinking/seed). PBT-09 framework (fast-check) finalized in NFR Requirements.
- No blocking PBT findings at Application Design.
