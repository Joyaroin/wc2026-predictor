# External Integrations

**Analysis Date:** 2026-06-13

## APIs & External Services

**Match Fixture & Results Data:**
- football-data.org (api.football-data.org/v4) — authoritative source for WC 2026 fixtures, live scores, and results
  - SDK/Client: custom `FootballApiClient` at `api/src/integration/footballApiClient.ts` (native `fetch` with retry/backoff)
  - Auth: `X-Auth-Token` header
  - Env var: `FOOTBALL_DATA_TOKEN`
  - Endpoint used: `GET /v4/competitions/{competition}/matches` (competition defaults to `WC`)
  - Retry: 3 attempts with exponential backoff (250ms base, jittered), 8s request timeout per attempt
  - Error handling: fail-soft — on total failure, keeps last-known data and reports error without crashing

**Player Pool & Goal Statistics:**
- ESPN (unofficial, no API key) — `site.api.espn.com/apis/site/v2/sports/soccer/fifa.world`
  - SDK/Client: custom `EspnClient` at `api/src/integration/espnClient.ts` (native `fetch`, no auth)
  - No authentication required
  - Endpoints used:
    - `GET /teams` — all WC team list
    - `GET /teams/{id}/roster` — squad players per team (Golden Boot player pool)
    - `GET /scoreboard?dates={YYYYMMDD}` — finished match events with goal details
  - Data extracted: player pool (id, name, team, position), goalscorers per match event, first-goal facts
  - Called by `sync.run.ts` CronJob (every 2 minutes via Kubernetes CronJob); not called during regular API request handling
  - Failure is soft — per-team roster failures are warned and skipped; ESPN facts ingest failure is warned and skipped

## Data Storage

**Databases:**
- AWS DynamoDB — single-table design, one table per environment (`wc2026-dev`, `wc2026-prod`)
  - Connection: AWS region via `AWS_REGION` (default `us-east-1`), optional local endpoint via `DYNAMODB_ENDPOINT`
  - Table name: `TABLE_NAME` env var (required when `PERSISTENCE=dynamo`)
  - Client: AWS SDK v3 Document Client (`@aws-sdk/client-dynamodb` + `@aws-sdk/lib-dynamodb`) — `api/src/repos/dynamo.ts`
  - Auth: IAM role via IRSA (pod-level AWS role annotation in Helm `serviceAccount.roleArn`)
  - GSIs: `GSI1` (GSI1PK/GSI1SK) for invite-code lookup and cross-entity queries; `GSI2` (GSI2PK/GSI2SK) for schedule queries
  - Features enabled: point-in-time recovery, server-side encryption at rest
  - Billing: PAY_PER_REQUEST (on-demand)
  - Entities stored: players, name locks, group metadata, memberships, matches, predictions, bracket picks, golden boot picks, dark horse picks, tournament winner picks, player-of-tournament picks, feedback, stats (leader, ESPN run timestamp, POTT winner)

**In-Memory Store (development only):**
- `PERSISTENCE=memory` switches to `api/src/repos/memory.ts` — full in-memory implementation of all repositories
  - No external dependencies required in this mode
  - Used for local dev and unit tests

**File Storage:**
- None — no file/blob storage service integrated

**Caching:**
- None — no Redis or in-memory cache layer; TanStack Query handles client-side caching with `staleTime: 30_000ms`

## Authentication & Identity

**Auth Provider:**
- Custom (no third-party auth provider)
  - Implementation: name + PIN login (`api/src/routes/` auth route, `api/src/services/auth.ts`)
  - Session tokens: stateless HMAC-SHA256 signed tokens — `base64url(payload).hmacSig` with expiry (`api/src/lib/token.ts`)
  - Signing secret: `SESSION_SIGNING_SECRET` env var (required)
  - Session TTL: `SESSION_TTL_DAYS` (default 30 days)
  - Token transport: `Authorization: Bearer <token>` header
  - PIN storage: hashed (`api/src/lib/pin.ts`), stored in DynamoDB player profile
  - Admin actions: separate `ADMIN_TOKEN` env var checked via `X-Admin-Token` header; `ADMIN_PLAYER` env var grants admin UI access to that player name

## Monitoring & Observability

**Error Tracking:**
- None — no Sentry, Datadog, or similar third-party error tracking

**Logs:**
- Structured JSON logging to stdout (`api/src/lib/logger.ts`)
- One JSON object per line: `{ ts, level, msg, ...fields }`
- CloudWatch captures container stdout (implied by logger comment)
- Automatic redaction of sensitive keys: `pin`, `pinHash`, `password`, `token`, `authorization`, `sessionSigningSecret`, `footballApiToken`, `apiKey`
- Levels: `info`, `warn`, `error`; `error` writes to `stderr`, others to `stdout`
- Child loggers bind per-request context (`requestId`, `method`, `path`)

## CI/CD & Deployment

**Hosting:**
- AWS EC2 single-node k3s cluster (managed by Terraform `infra/terraform/modules/k3s/`)
- Terraform provisions: EC2 instance, DynamoDB tables (dev + prod), SSM parameter for `FOOTBALL_DATA_TOKEN`, IAM roles for IRSA

**Container Registry:**
- GitHub Container Registry (GHCR): `ghcr.io/joyaroin/wc2026-api`, `ghcr.io/joyaroin/wc2026-web`
- Images tagged with git SHA and environment tag (`dev` / `prod`)
- Multi-arch build: `linux/arm64` via Docker Buildx + QEMU

**CI Pipeline:**
- GitHub Actions (`.github/workflows/ci.yml`)
  - Triggers: push to `main`/`release`, PR to `main`
  - Jobs: `test` (npm ci, build shared, npm test, npm audit --omit=dev) then `images` (build + push to GHCR)
  - Auto-deploy to dev: after push to `main`, CI bumps `infra/helm/wc2026/values-dev.yaml` image tags to SHA and pushes `[skip ci]` commit

**GitOps / CD:**
- ArgoCD auto-sync (`infra/gitops/apps/`)
  - `wc2026-dev`: tracks `main` branch, auto-sync with prune + self-heal
  - `wc2026-prod`: tracks `release` branch, deployed via `promote-to-prod` workflow
- Promotion: manual `workflow_dispatch` (`.github/workflows/promote-to-prod.yml`) with `production` environment approval gate; pins prod Helm values to the SHA, pushes to `release` branch; ArgoCD picks up the change

**Sync CronJob:**
- Kubernetes CronJob (defined in Helm chart) runs every 2 minutes: `node dist/sync.cjs`
- Calls football-data.org for fixture/score updates, ESPN for goal facts and Golden Boot tally
- Entry point: `api/src/sync.run.ts`

## Environment Configuration

**Required env vars:**
- `SESSION_SIGNING_SECRET` — HMAC signing key for session tokens
- `ALLOWED_ORIGIN` — CORS allowed origin
- `TABLE_NAME` — DynamoDB table name (required when `PERSISTENCE=dynamo`)

**Optional env vars:**
- `FOOTBALL_DATA_TOKEN` — football-data.org API key (sync fails without it, read API continues)
- `FOOTBALL_COMPETITION` — competition code (default: `WC`)
- `AWS_REGION` — AWS region (default: `us-east-1`)
- `DYNAMODB_ENDPOINT` — override DynamoDB endpoint (for DynamoDB Local in dev)
- `SESSION_TTL_DAYS` — session lifetime in days (default: `30`)
- `PERSISTENCE` — `dynamo` (default) or `memory` (in-memory dev mode)
- `ADMIN_TOKEN` — token for admin API actions
- `ADMIN_PLAYER` — player name with admin UI access (default: `adham`)
- `SYNC_ON_START` — if `true`, triggers a sync on API startup (dev convenience)
- `PORT` — API listen port (default: `4000`)
- `VITE_API_URL` — web build-time base URL for API (default: `http://localhost:4000`)

**Secrets location:**
- Production: Kubernetes Secret (external-secrets or manually created); referenced in Helm chart via `secret.existingSecret`
- `FOOTBALL_DATA_TOKEN` stored in AWS SSM Parameter Store at `/wc2026/football-data-token` (SecureString) — provisioned by Terraform

## Webhooks & Callbacks

**Incoming:**
- None — no webhook endpoints; data is pulled on a schedule (CronJob)

**Outgoing:**
- None — no outgoing webhooks

---

*Integration audit: 2026-06-13*
