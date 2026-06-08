# AI-DLC State Tracking

## Project Information
- **Project Name**: WC2026 Predictor (FIFA-style score prediction game)
- **Project Type**: Greenfield
- **Start Date**: 2026-06-07T12:10:00Z
- **Current Stage**: OPERATIONS - Placeholder (workflow complete)

## Workspace State
- **Existing Code**: Yes (monorepo application generated)
- **Programming Languages**: TypeScript (React + Node/Express), HCL, Helm YAML
- **Build System**: npm workspaces, Vite, esbuild, Terraform, Helm
- **Project Structure**: `packages/shared`, `api`, `web`, `infra`
- **Reverse Engineering Needed**: No
- **Workspace Root**: /Users/adhamsedik/match_worldcup_predictor

## Code Location Rules
- **Application Code**: Workspace root (NEVER in aidlc-docs/)
- **Documentation**: aidlc-docs/ only
- **Structure patterns**: See code-generation.md Critical Rules

## Execution Plan Summary
- **Total Stages**: 14 (incl. completed)
- **Stages to Execute (remaining)**: None
- **Stages Skipped**: Reverse Engineering (greenfield)
- **Current Status**: Build and Test approved; AI-DLC workflow complete. Operations is currently a placeholder stage.

## Stage Progress
### 🔵 INCEPTION PHASE
- [x] Workspace Detection
- [ ] Reverse Engineering (N/A — greenfield)
- [x] Requirements Analysis
- [x] User Stories
- [x] Workflow Planning
- [x] Application Design — EXECUTE
- [x] Units Generation — EXECUTE (4 units: shared, backend, web, infra)

### 🟢 CONSTRUCTION PHASE
Build order: shared → backend → web → infra
- [x] Unit `shared`: Functional Design [x] → Code Generation [x] (22 tests pass, 0 vulns)
- [x] Unit `backend`: Functional Design → NFR Requirements → NFR Design → Code Generation [x] (26 tests pass, 0 vulns, tsc clean)
- [x] Unit `web`: Code Generation [x] (5 tests pass, vite build ok, tsc clean, 0 vulns)
- [x] Unit `infra`: Infrastructure Design → Code Generation [x] (Terraform+Helm+ArgoCD; helm lint/template + terraform validate ×3 envs + bundles all pass)
- [x] Build and Test (all units) (npm build/test/audit pass; API bundles pass; Docker api/web image builds pass; Helm dev/prod lint+template pass; Terraform init+validate pass)

**Current**: CONSTRUCTION — Build and Test COMPLETE and approved.

### 🟡 OPERATIONS PHASE
- [x] Operations (placeholder; no executable AI-DLC workflow in this ruleset)

## Extension Configuration
| Extension | Enabled | Mode | Decided At |
|---|---|---|---|
| Security Baseline | Yes | Full (all SECURITY-01..15 blocking) | Requirements Analysis |
| Property-Based Testing | Yes | Partial (only PBT-02, PBT-03, PBT-07, PBT-08, PBT-09 enforced; rest advisory) | Requirements Analysis |

## Key Decisions (Requirements Analysis)
- **Stack**: React (frontend) + Node/Express (backend), JavaScript/TypeScript
- **Identity**: Unique name + 4-digit PIN (cross-device resume; no email/accounts). PIN hashed (scrypt), login rate-limited, signed session token per request. SECURITY-12 now in-scope. (Updated in backend Functional Design: CQ1=A, CQ2=A, CQ3=B)
- **Groups**: Friend groups joined via short invite code; per-group leaderboards
- **Scoring**: Exact 5 / Goal-difference 3 / Result 2 / Wrong 0
- **Knockouts**: Predict 90-minute scoreline only (draws allowed)
- **Lock**: Predictions lock at match kickoff time
- **Tie-breaker**: Most exact scores, then most correct results
- **Fixtures**: Live free/low-cost football API; API key REQUIRED (no offline/seed mode)
- **Deployment**: **Kubernetes via k3s on a single EC2 node** (~$12/mo, cheap public) with **dev + prod** namespaces, GitOps via **ArgoCD** + **Helm**; **Terraform** provisions EC2 + DynamoDB ×2 + SSM + IAM instance role; images on **public GHCR**. Containerized api (Node server) + web (nginx) + sync CronJob. (Evolved 2026-06-08: serverless/Lambda → EKS → **k3s-on-EC2** for cost; EKS design retained as HA option, serverless archived.)
- **Persistence**: AWS DynamoDB (managed), accessed from pods via the **EC2 instance role** (no static keys, no IRSA)
