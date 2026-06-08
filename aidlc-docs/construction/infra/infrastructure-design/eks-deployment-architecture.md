# Deployment Architecture — Unit `infra` (Kubernetes / GitOps)

## Repository layout (monorepo `infra/` + container files)
```
api/Dockerfile                 # Node server image (api) — also used by the sync CronJob
web/Dockerfile                 # nginx image serving web/dist
web/nginx.conf                 # SPA fallback

infra/
├── terraform/                 # AWS substrate
│   ├── modules/
│   │   ├── eks/               # VPC + EKS cluster + node group + OIDC
│   │   ├── data/              # DynamoDB table (per env) + PITR/SSE
│   │   ├── ecr/               # api + web repositories
│   │   └── irsa/              # IAM role for the api ServiceAccount (scoped to env table)
│   └── environments/
│       ├── dev/               # cluster (shared) + dev table + dev IRSA
│       └── prod/              # prod table + prod IRSA
├── helm/
│   └── wc2026/                # one chart deploys api+web+sync+ingress
│       ├── Chart.yaml
│       ├── values.yaml        # defaults
│       ├── values-dev.yaml    # dev overrides (replicas, host, image tag)
│       ├── values-prod.yaml   # prod overrides
│       └── templates/         # deployment-api, service-api, deployment-web, service-web,
│                              # cronjob-sync, ingress, serviceaccount(IRSA), configmap,
│                              # secret (placeholder), networkpolicy, hpa
└── gitops/                    # ArgoCD
    ├── bootstrap/             # root "app-of-apps" Application
    └── apps/                  # Application(dev), Application(prod)
```

## dev + prod (GitOps promotion)
- **dev** namespace `wc2026-dev`: ArgoCD `Application` tracks **`HEAD` of the default branch**, `syncPolicy: automated` (+ prune + selfHeal). Every merge auto-deploys to dev for testing. Image tag = latest built SHA.
- **prod** namespace `wc2026-prod`: ArgoCD `Application` tracks a **release ref** (git tag like `release-*` or values pinned to a vetted image SHA), **manual sync** (promotion). "Updates apply" to prod only when you promote.
- Promotion = update `values-prod.yaml` image tag (or move the release tag) and let ArgoCD sync prod. (Argo CD Image Updater is an optional automation.)

## Resource topology (per environment)
```
        Internet (HTTPS)
              │
        [ ingress-nginx → AWS NLB ]  TLS via cert-manager (Let's Encrypt)
              │   host: dev.<domain> / prod.<domain>
       ┌──────┴───────┐
   path / │           │ path /api
          v           v
   [ web Deploy ]   [ api Deploy ]  (IRSA ServiceAccount)
   (nginx, dist)      │  env: TABLE_NAME, ALLOWED_ORIGIN, PERSISTENCE=dynamo
                      │  secret: SESSION_SIGNING_SECRET, FOOTBALL_DATA_TOKEN
                      v
              [ AWS DynamoDB wc2026-<env> ]  (IRSA-scoped)
                      ^
   [ CronJob sync */10 ] ─ node dist/sync.cjs ── HTTPS ─▶ football-data.org

   ArgoCD (in cluster) ◀─ watches this git repo ─ syncs Helm releases to both namespaces
```

## Same-origin routing (no CORS headaches)
Ingress routes `/api/*` → api Service and `/*` → web Service on **one host per env**. The web image is built with `VITE_API_URL=""` so the SPA calls `/api/...` same-origin; the API's `ALLOWED_ORIGIN` is set to the env host.

## Image build & push (CI — GitHub Actions)
1. `npm ci` → `npm test` (shared+api+web) → `npm audit`.
2. Build `web/dist` (Vite, `VITE_API_URL=""`).
3. Bundle server: `api` esbuild → `dist/server.cjs` + `dist/sync.cjs`.
4. `docker build` api + web → tag `:<git-sha>` → push to **ECR** (scan-on-push).
5. Update dev image tag (commit to `values-dev.yaml` or via Image Updater) → ArgoCD syncs dev.
6. Promote: bump `values-prod.yaml` tag / move release tag → ArgoCD syncs prod.
- Pinned tool/image versions; no `latest` in manifests (SECURITY-10/13).

## Secrets handling
- `SESSION_SIGNING_SECRET` and `FOOTBALL_DATA_TOKEN` live in a Kubernetes `Secret` per namespace.
- Recommended: **external-secrets operator** syncing them from **AWS Secrets Manager** (so values are never in git). The Helm `secret.yaml` is a placeholder/`ExternalSecret` reference — values are **never committed**.
- AWS access for DynamoDB uses **IRSA** (no static keys).

## Verification possible locally (no AWS)
- `docker build` both images (if Docker available).
- `helm lint` + `helm template` the chart (render manifests).
- `terraform fmt` + `terraform validate` the modules.
- `kubeconform`/`kubectl --dry-run` on rendered manifests (if available).
- **Not deployed** — EKS/ArgoCD require an AWS account + live cluster.

## Caveats
- Custom domain + ACM/Route53 (or Let's Encrypt DNS) needed for real TLS hostnames — placeholders provided.
- Two namespaces in one cluster share the control plane; for hard prod isolation, split into two clusters (documented, more cost).
