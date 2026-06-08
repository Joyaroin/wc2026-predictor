# Units of Work — WC2026 Predictor

Decomposition: **4 units** in a TypeScript **monorepo** (npm workspaces). Not microservices — the backend deploys as one API Lambda plus one scheduled Sync Lambda.

## Code organization strategy (greenfield)
```
match_worldcup_predictor/
├── package.json                # npm workspaces root
├── packages/
│   └── shared/                 # UNIT 1: shared types + scoring (pure)
│       ├── src/{types,scoring,schemas}.ts
│       └── test/               # PBT + example tests for scoring
├── api/                        # UNIT 2: backend (Express, Lambda-adaptable)
│   ├── src/
│   │   ├── app.ts              # express app + middleware pipeline
│   │   ├── lambda.ts           # API Gateway handler adapter
│   │   ├── sync.lambda.ts      # scheduled sync handler
│   │   ├── routes/             # controllers
│   │   ├── services/           # domain services
│   │   ├── repos/              # DynamoDB single-table repositories
│   │   ├── integration/        # FootballApiClient
│   │   ├── middleware/         # validation, identity, authz, errors, logger, rateLimit, headers
│   │   └── config.ts
│   └── test/                   # unit + integration tests
├── web/                        # UNIT 3: React SPA (Vite + TS + TanStack Query)
│   └── src/{pages,components,api,context}/
└── infra/                      # UNIT 4: AWS IaC (CDK in TypeScript)
    └── lib/                    # stacks: data, api, web, sync, observability
```

## Unit definitions

### UNIT 1 — `shared` (packages/shared)
- **Responsibility**: Domain types, zod schemas, and the **pure scoring engine** (computePoints, outcome, tie-break comparator). No I/O.
- **Why a unit**: Consumed by both `backend` and `web`; the scoring engine is the primary correctness asset and PBT target.
- **Deploys as**: published/linked workspace package (not deployed standalone).
- **Design depth (targeted)**: Functional Design covers scoring rules + PBT-01 property identification; no NFR/Infra design.

### UNIT 2 — `backend` (api/)
- **Responsibility**: REST API (controllers → services → repos), DynamoDB persistence, external-API integration, scheduled sync + precompute scoring, all cross-cutting security middleware.
- **Why a unit**: The core server-side capability; one cohesive deployable (API Lambda + Sync Lambda).
- **Deploys as**: AWS Lambda(s) behind API Gateway; EventBridge-scheduled sync.
- **Design depth (targeted)**: Functional Design (lock/ownership/visibility/sync business rules) + NFR Requirements + NFR Design (security patterns, logging, errors, rate limiting). Hosts most Security Baseline app-rules and PBT-02 (DTO round-trips).

### UNIT 3 — `web` (web/)
- **Responsibility**: React SPA — pages, components, typed API client, player context, TanStack Query.
- **Why a unit**: Independently buildable/deployable static frontend.
- **Deploys as**: static assets on S3 + CloudFront.
- **Design depth (targeted)**: light — straight to Code Generation; consumes shared types + API contract. SECURITY-04 headers/SRI verified at build.

### UNIT 4 — `infra` (infra/)
- **Responsibility**: AWS CDK stacks — DynamoDB table+GSIs, Lambda(s), API Gateway, S3/CloudFront, IAM least-privilege, Secrets Manager (API key), CloudWatch logs/alarms, EventBridge schedule.
- **Why a unit**: Deployment/operational concerns separated from app code.
- **Deploys as**: CloudFormation via CDK.
- **Design depth (targeted)**: Infrastructure Design stage (maps NFR/security infra rules: SECURITY-01/02/06/07/10/14).

## Build / sequence order
**shared → backend → web → infra** (dependency order). Each unit completes its targeted design + code before the next, per the Construction per-unit loop.
