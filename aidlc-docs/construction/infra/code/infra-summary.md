# Code Summary — Unit `infra` (Kubernetes / EKS / GitOps)

## Verification (executed)
| Check | Result |
|---|---|
| esbuild bundle (`api`) | ✅ `dist/server.cjs` + `dist/sync.cjs` built; `node --check` passes on both |
| `npm audit` | ✅ 0 vulnerabilities |
| `helm lint` | ✅ 0 failed |
| `helm template` dev / prod | ✅ 9 / 10 manifests render and parse as valid YAML |
| Terraform `validate` — dev / prod / cluster | ✅ all "Success! The configuration is valid." (cluster incl. VPC/EKS registry modules) |
| Terraform `fmt -check` | ✅ clean |
| GitOps manifests (ArgoCD) | ✅ all parse; apiVersion+kind present |
| `docker build` | ⚠️ not run — Docker daemon not running locally. Dockerfiles authored; their build steps (npm ci, shared build, vite build, esbuild bundle) are each independently verified |
| `terraform apply` / deploy | ⏸️ not run — needs the user's AWS account + ~20 min EKS provisioning (cost). Deploy steps in infra/README.md |

## Files created
**Containers**: `api/Dockerfile`, `api/scripts/bundle.mjs`, `api/src/sync.run.ts` (CronJob entry), `web/Dockerfile`, `web/nginx.conf`, root `.dockerignore`. (`api/package.json`: + esbuild devDep + `build:server`.)

**Terraform** (`infra/terraform/`): modules `eks` (VPC+EKS+nodegroup+OIDC), `data` (DynamoDB PITR/SSE), `ecr` (scan-on-push, immutable), `irsa` (OIDC-trust IAM role, DynamoDB scoped to table+index); environments `cluster`, `dev`, `prod` (each versions/backend/tfvars).

**Helm** (`infra/helm/wc2026/`): Chart + values + values-dev + values-prod; templates: serviceaccount (IRSA), configmap, secret (placeholder), deployment-api, service-api, deployment-web, service-web, cronjob-sync, ingress, networkpolicy, hpa, _helpers.

**GitOps** (`infra/gitops/`): AppProject, app-of-apps root, `wc2026-dev` (auto-sync HEAD), `wc2026-prod` (manual promotion via `release`).

**CI**: `.github/workflows/ci.yml` (test + audit + build/push images to ECR by SHA via OIDC).

**Docs**: `infra/README.md`.

## Security mapping realized
🔒 SECURITY-01 (DynamoDB SSE+PITR, EKS secret KMS, TLS via cert-manager), 02 (ingress access logs), 03 (stdout→CloudWatch), 04 (helmet + headers), 06 (**IRSA least-privilege**, scoped table/index ARNs, no wildcards, no static keys), 07 (private nodes, NetworkPolicy, ingress-only exposure), 09 (non-root, readOnlyRootFilesystem, dropped caps, immutable ECR tags), 10 (scan-on-push, `npm audit` in CI, pinned versions), 12 (secrets via external-secrets/K8s Secret), 14 (probes, CronJob history limits, ArgoCD visibility). **No blocking findings.**

## Notes
- No business-logic changes — the app already runs as a long-lived server; only packaging + a CronJob entry were added.
- Fixed during generation: empty prod image tag produced invalid YAML (`image: repo:`) → image values are now `| quote`d.
- `dev` auto-syncs `main`; `prod` is promoted by moving the `release` ref / pinning the image tag in `values-prod.yaml`.
