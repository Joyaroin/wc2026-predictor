# Code Summary — Unit `infra` (k3s on EC2 + Helm + ArgoCD)

**Target (final):** cheap public Kubernetes — a single **k3s** EC2 node (~$12/mo) on the user's AWS account, GitOps via **ArgoCD**, packaged with **Helm**. Chosen for cost (vs EKS ~$150/mo). The Helm chart + ArgoCD manifests are unchanged from the EKS design; only the Terraform substrate + pod→DynamoDB auth differ.

## Verification (executed)
| Check | Result |
|---|---|
| esbuild bundle (`api`) | ✅ `server.cjs` + `sync.cjs`; `node --check` passes |
| `npm audit` | ✅ 0 vulnerabilities |
| `helm lint` | ✅ 0 failed |
| `helm template` dev / prod | ✅ 9 / 9 manifests; images resolve to `ghcr.io/joyaroin/wc2026-*` |
| Terraform `validate` (aws/k3s env) | ✅ "Success! The configuration is valid." |
| Terraform `fmt` | ✅ clean |
| GitOps manifests | ✅ valid |
| `docker build` | ⚠️ not run (Docker daemon down locally) |
| `terraform apply` / deploy | ⏸️ not run (user decides; ~$12/mo while up) |

## What changed vs the EKS design
- **Terraform**: removed `modules/eks`, `modules/ecr`, `modules/irsa` and the `cluster`/`dev`/`prod` envs. Added **`modules/k3s`** (EC2 + security group + IAM **instance role** scoped to DynamoDB + SSM read + Session Manager + EIP + a `user-data` bootstrap that installs k3s, ingress-nginx, ArgoCD, the app secrets from SSM, and the GitOps app-of-apps) and a single **`environments/aws`** (DynamoDB ×2 via `modules/data`, an SSM SecureString for the football token, and the `k3s` node).
- **Auth**: pods reach DynamoDB via the **EC2 instance role** (AWS SDK auto-discovers from IMDS) — no IRSA, no static keys, no backend change.
- **Images**: **public GHCR** (`ghcr.io/joyaroin/wc2026-{api,web}`) — k3s pulls without credentials. CI (`.github/workflows/ci.yml`) pushes to GHCR via the built-in `GITHUB_TOKEN`.
- **Helm**: `values-dev/prod` now use the GHCR registry, empty `serviceAccount.roleArn` (instance role), TLS disabled + `nip.io` host placeholder (no-domain start).
- **Bootstrap**: `user-data.sh.tftpl` self-installs the whole GitOps stack on first boot.

## Files (current infra)
- Containers: `api/Dockerfile`, `api/scripts/bundle.mjs`, `api/src/sync.run.ts`, `web/Dockerfile`, `web/nginx.conf`, `.dockerignore`.
- Terraform: `modules/data`, `modules/k3s` (+ `user-data.sh.tftpl`), `environments/aws`.
- Helm: `infra/helm/wc2026/` (Chart, values, values-dev, values-prod, 12 templates).
- GitOps: `infra/gitops/` (AppProject, root app-of-apps, dev auto-sync, prod manual).
- CI: `.github/workflows/ci.yml` (GHCR).
- Docs: `infra/README.md`.

## Security mapping
🔒 SECURITY-01 (DynamoDB SSE+PITR; EBS encrypted; TLS add-on later), 03 (stdout logs), 04 (helmet + headers), 06 (**instance role least-privilege** scoped to the two table ARNs + index/\*, SSM read of one parameter; no wildcards), 07 (SG opens only 80/443 public, SSH restrictable, Session Manager preferred), 09 (non-root, readOnlyRootFilesystem, dropped caps), 10 (public pinned images, `npm audit` in CI), 12 (football token in **SSM SecureString**, signing secret generated on-node; never in git), 14 (k3s/ArgoCD health visibility). **No blocking findings.**

## Operational notes / caveats
- **One-time**: set the GHCR packages to **Public** after first CI push so k3s can pull.
- After `terraform apply`, replace `REPLACE-EIP` in `values-dev/prod.yaml` with the EIP (dashed) and push → ArgoCD syncs.
- Single node = no HA (acceptable for a hobby app). HTTPS needs a domain + cert-manager (documented).
- The EKS design is retained in `infrastructure-design/eks-*.md` as the HA/managed option.
