> ⚠️ **SUPERSEDED (2026-06-08)** by the Kubernetes/EKS + GitOps design — see [eks-deployment-architecture.md](eks-deployment-architecture.md). Retained for history.

---

# Deployment Architecture — Unit `infra`  *(ARCHIVED — serverless option)*

## Terraform layout (monorepo `infra/`)
```
infra/
├── modules/
│   └── wc2026/                # reusable module: all resources, parameterized by var.environment
│       ├── main.tf            # dynamodb, lambdas, http api, s3, cloudfront, secrets, cloudwatch
│       ├── iam.tf             # least-privilege roles/policies
│       ├── variables.tf
│       └── outputs.tf         # api_url, cloudfront_url, table_name
├── environments/
│   ├── dev/                   # terraform init/apply here for dev
│   │   ├── main.tf            # module "wc2026" { environment = "dev" ... }
│   │   ├── backend.tf         # remote state (S3 + DynamoDB lock) — placeholder
│   │   └── terraform.tfvars
│   └── prod/
│       ├── main.tf            # environment = "prod"
│       ├── backend.tf
│       └── terraform.tfvars
└── README.md
```
Two environments (Q2=B) share one module; each `environments/<env>` is a separate Terraform root/state.

## Resource topology (per environment)
```
                         Internet (HTTPS)
              ┌──────────────────────┴───────────────────────┐
              v                                               v
   [ CloudFront distribution ]                      [ API Gateway HTTP API ]
     - OAC to private S3                               - access logs → CloudWatch
     - response headers policy (CSP/HSTS/…)            - CORS: CloudFront origin only
     - SPA fallback 403/404 → /index.html              - $default route → proxy
              |                                               |
              v                                               v
        [ S3 (web/dist) ]                            [ Lambda: API (nodejs22.x) ]
         - Block Public Access                         - env: TABLE_NAME, ALLOWED_ORIGIN…
                                                        - secrets: signing key, football token
                                                        |
                                                        v
                                              [ DynamoDB wc2026-<env> ]
                                                 - PK/SK + GSI1 + GSI2
                                                 - on-demand, PITR, SSE
                                                        ^
                                                        |
   [ EventBridge rate(10 min) ] ─▶ [ Lambda: Sync ] ───┘  ──HTTPS──▶ football-data.org
                                       - reads football token secret

   All Lambdas → CloudWatch Logs (90-day retention) + Alarms (errors/throttles/5xx)
   Secrets Manager: wc2026/<env>/session-signing-secret, wc2026/<env>/football-token
```

## Build & deploy flow
1. **Bundle Lambdas** (esbuild): `api` build script produces `api/dist/lambda.zip` and `api/dist/sync.zip` (single-file bundles incl. `@wc2026/shared`). Terraform `aws_lambda_function` references the zip via `filename` + `source_code_hash`.
2. **Build web**: `npm run build --workspace @wc2026/web` → `web/dist`.
3. **terraform apply** (in `environments/<env>`): provisions/updates all resources and uploads `web/dist` to S3 (via `aws_s3_object` for-each, or a post-apply `aws s3 sync`), then a CloudFront invalidation.
4. **Secrets**: created once per env (Terraform creates the secret resources; the actual secret *values* — football token, signing key — are set out-of-band via `aws secretsmanager put-secret-value`, not committed to state/VCS).
5. **Remote state**: `backend.tf` configures S3 state + DynamoDB lock table (placeholders to fill with the user's state bucket).

## CI/CD (documented; pipeline file optional)
- `npm ci` → `npm test` (shared+api+web) → `npm audit` → bundle Lambdas + build web → `terraform plan`/`apply` (manual approval for prod).
- Pipeline definitions are access-controlled; no `latest` image tags; pinned tool versions (SECURITY-10/13).

## Notes / caveats
- **No VPC**: all services are public-managed endpoints; data protected by IAM + TLS + auth (documented under SECURITY-07).
- **Custom domain**: not in v1; add ACM cert + Route53 + CloudFront alias later.
- The Terraform here is **deploy-ready scaffolding**; `terraform apply` requires real AWS credentials and a state backend, so it is **not executed** in this environment — it is validated with `terraform fmt`/`validate` where the CLI is available.
