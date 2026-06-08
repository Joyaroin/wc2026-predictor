# Code Generation Plan — Unit `infra` (Kubernetes / EKS / GitOps)

Replaces the prior serverless Terraform plan. Tooling available: **docker, helm v4, kubectl, terraform v1.14.8** → real local verification (no deploy).
Outputs: container files in `api/` + `web/`; Terraform + Helm + ArgoCD under `infra/`. Summary → `aidlc-docs/construction/infra/code/`.

---

## Steps

### Step 1 — Container build entries (in `api/`) [x]
Add pinned `esbuild` devDep + `scripts/bundle.mjs` bundling `src/app.ts`→`dist/server.cjs` and a new `src/sync.run.ts`→`dist/sync.cjs` (one-shot sync runner that exits). Add `build:server` npm script. (No business-logic change.)

### Step 2 — Dockerfiles [x]
- `api/Dockerfile` — multi-stage (build shared+api bundles → minimal `node:22` runtime, **non-root**, `dist/` only). CMD `node dist/server.cjs`.
- `web/Dockerfile` — build Vite (`VITE_API_URL=""`) → `nginx` runtime; `web/nginx.conf` (SPA fallback, no secrets).
- `.dockerignore` files.

### Step 3 — Terraform substrate [x]
`infra/terraform/`:
- `modules/eks/` (VPC + EKS + node group + OIDC — using pinned `terraform-aws-modules`), `modules/data/` (DynamoDB single-table per env, PITR/SSE), `modules/ecr/` (api+web repos, scan-on-push), `modules/irsa/` (IAM role for api ServiceAccount scoped to env table/index).
- `environments/dev/` and `environments/prod/` (`main.tf`, `versions.tf`, `backend.tf` remote-state placeholder, `terraform.tfvars`). Cluster created once (in dev env or a shared env); dev/prod each get a table + IRSA.

### Step 4 — Helm chart [x]
`infra/helm/wc2026/`: `Chart.yaml`, `values.yaml`, `values-dev.yaml`, `values-prod.yaml`, and `templates/`: `serviceaccount.yaml` (IRSA annotation), `deployment-api.yaml`, `service-api.yaml`, `deployment-web.yaml`, `service-web.yaml`, `cronjob-sync.yaml`, `ingress.yaml` (path /api→api, /→web, cert-manager + TLS), `configmap.yaml`, `secret.yaml` (placeholder/ExternalSecret), `networkpolicy.yaml`, `hpa.yaml`, `_helpers.tpl`. Hardened securityContext, probes, resources.

### Step 5 — ArgoCD GitOps [x]
`infra/gitops/`: `bootstrap/root-app.yaml` (app-of-apps), `apps/wc2026-dev.yaml` (HEAD, automated sync), `apps/wc2026-prod.yaml` (release ref, manual sync), `projects/wc2026.yaml` (AppProject). Plus `argocd/README` for install.

### Step 6 — CI (image build/push) [x]
`.github/workflows/ci.yml` — test (shared+api+web) + `npm audit` + build/push api+web images to ECR by git SHA (documented; no secrets committed).

### Step 7 — Docs [x]
`infra/README.md` (prereqs, terraform apply order, ECR login/build/push, ArgoCD install + app-of-apps, secrets via external-secrets, dev→prod promotion, destroy) + `aidlc-docs/construction/infra/code/infra-summary.md`.

### Step 8 — Verify [x]
- `npm run build:server --workspace @wc2026/api` → `dist/server.cjs` + `dist/sync.cjs`.
- `helm lint infra/helm/wc2026` + `helm template … -f values-dev.yaml` (render) → pipe to `kubectl apply --dry-run=client`.
- `terraform fmt -recursive infra/terraform` + `terraform -chdir=infra/terraform/environments/dev init -backend=false && validate`.
- `docker build` api + web (if the Docker daemon is running; else note).
- Report all results.

---

## Story / security traceability
US-3.4 (sync CronJob), US-7.1 (secrets/external-secrets), US-7.3 (ingress/helmet headers + TLS), US-7.4 (logging/CloudWatch), US-7.5 (rate-limit app-tier; NetworkPolicies defense-in-depth). 🔒 SECURITY-01/02/03/04/06/07/09/10/12/14 realized.

## Notes
- **Not deployed** (needs AWS account + live EKS/ArgoCD). Verified via bundle + docker build + helm lint/template + kubectl dry-run + terraform validate.
- Small backend addition: `src/sync.run.ts` (CronJob entry) + bundling — no business-logic change.

## Scope
~30 files (Dockerfiles, ~12 Terraform, ~14 Helm, ~4 ArgoCD, CI, docs).
