# Technology Stack

**Analysis Date:** 2026-06-13

## Languages

**Primary:**
- TypeScript 5.7.2 - All source code across `api/`, `web/`, and `packages/shared/`

**Secondary:**
- HCL (Terraform) - Infrastructure definitions in `infra/terraform/`
- YAML - Kubernetes Helm charts in `infra/helm/`, GitOps in `infra/gitops/`

## Runtime

**Environment:**
- Node.js 22 (LTS) — enforced via `engines.node >= 22` in `package.json` and `.nvmrc` (value: `22`)

**Package Manager:**
- npm (npm workspaces monorepo)
- Lockfile: `package-lock.json` present at repo root

## Frameworks

**Core (API):**
- Express 5.2.1 — HTTP server (`api/src/server.ts`, `api/src/app.ts`)
- `@codegenie/serverless-express` 4.16.0 — AWS Lambda adapter wrapping Express (`api/src/lambda.ts`)

**Core (Web):**
- React 19.2.7 — UI framework (`web/src/main.tsx`)
- React Router DOM 7.17.0 — client-side routing
- TanStack Query (`@tanstack/react-query`) 5.101.0 — server state and data fetching (`web/src/main.tsx`)

**Validation:**
- Zod 3.24.1 — request body validation in API middleware (`api/src/middleware/index.ts`) and shared type schemas (`packages/shared/`)

**Testing:**
- Vitest 4.1.8 — test runner for all packages (`api/`, `web/`, `packages/shared/`)
- Supertest 7.2.2 — HTTP integration testing in API (`api/` devDependencies)
- fast-check 3.23.1 — property-based testing in `api/` and `packages/shared/`

**Build/Dev:**
- Vite 8.0.16 with `@vitejs/plugin-react` 6.0.2 — web bundler (`web/vite.config.ts`)
- esbuild 0.28.0 — API server bundler (`api/scripts/bundle.mjs`)
- tsx 4.22.4 — TypeScript execution for dev server and scripts (`api/` devDependencies)
- tsc (TypeScript compiler) — type checking and `packages/shared/` build

**Security/Middleware:**
- Helmet 8.2.0 — HTTP security headers
- cors 2.8.6 — CORS handling
- express-rate-limit 8.5.2 — rate limiting (global 120/min, login 10/min, join 20/min — `api/src/middleware/index.ts`)

**UI Utilities:**
- driver.js 1.4.0 — onboarding tour (`web/src/tour.ts`)

## Key Dependencies

**Critical:**
- `@aws-sdk/client-dynamodb` 3.1063.0 + `@aws-sdk/lib-dynamodb` 3.1063.0 — primary data store access (AWS SDK v3 Document Client, `api/src/repos/dynamo.ts`)
- `@wc2026/shared` (workspace `*`) — shared domain types and Zod schemas used by both `api/` and `web/`
- `zod` 3.24.1 — validation at API boundary and shared type definitions

**Infrastructure:**
- `@codegenie/serverless-express` 4.16.0 — Lambda entry point (`api/src/lambda.ts`); allows same Express app to run locally or as Lambda

## Configuration

**Environment:**
- API reads env vars via `api/src/lib/config.ts` with fail-fast validation at startup
- Required vars: `SESSION_SIGNING_SECRET`, `ALLOWED_ORIGIN` (when `PERSISTENCE=dynamo`: also `TABLE_NAME`)
- Optional vars: `DYNAMODB_ENDPOINT` (for DynamoDB Local), `AWS_REGION` (default `us-east-1`), `FOOTBALL_DATA_TOKEN`, `FOOTBALL_COMPETITION` (default `WC`), `SESSION_TTL_DAYS` (default `30`), `ADMIN_TOKEN`, `ADMIN_PLAYER`, `PERSISTENCE` (`dynamo` or `memory`)
- `PERSISTENCE=memory` enables a fully in-memory repo for local dev without AWS
- Web reads `VITE_API_URL` at build time (`web/src/api/client.ts`); defaults to `http://localhost:4000`
- `.env` and `.env.*` are gitignored; secrets injected via Kubernetes secrets or AWS SSM

**Build:**
- `tsconfig.base.json` — shared TypeScript base: `ES2022` target, strict mode, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`
- `web/tsconfig.json`, `api/tsconfig.json`, `packages/shared/tsconfig.json` — workspace-specific overrides
- `web/vite.config.ts` — Vite config with React plugin, dev port 5173, vitest config embedded
- `api/vitest.config.ts` — vitest config, test pattern `test/**/*.test.ts`, node environment

## Platform Requirements

**Development:**
- Node.js 22
- npm (workspaces)
- Optional: `DYNAMODB_ENDPOINT` pointing to DynamoDB Local when running with `PERSISTENCE=dynamo`; `PERSISTENCE=memory` avoids this dependency entirely
- Dev server: `npm run dev` in `api/` (tsx watch, port 4000) and `web/` (Vite, port 5173)

**Production:**
- Kubernetes (k3s single-node EC2) via Helm chart `infra/helm/wc2026/`
- Two environments: `wc2026-dev` (auto-deploys from `main`) and `wc2026-prod` (manual promotion to `release` branch)
- Container images pushed to GHCR: `ghcr.io/joyaroin/wc2026-api` and `ghcr.io/joyaroin/wc2026-web`
- API container: Node.js 22 Bookworm slim, bundles to `dist/server.cjs` and `dist/sync.cjs`
- Web container: nginx-unprivileged 1.27-alpine serving static SPA on port 8080
- GitOps: ArgoCD auto-sync from Helm chart in repo (`infra/gitops/apps/`)

---

*Stack analysis: 2026-06-13*
