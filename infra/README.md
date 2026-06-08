# infra — cheap public Kubernetes (k3s on EC2) + GitOps

Runs the WC2026 Predictor on a **single small EC2 instance** with **k3s** (lightweight Kubernetes), **ArgoCD** (GitOps), and **ingress-nginx** — **~$12/mo** (t4g.small) on your own AWS account. DynamoDB is reached via the **EC2 instance role** (no static keys).

```
infra/
├── terraform/   # EC2 + k3s bootstrap, DynamoDB (dev/prod), SSM secret, IAM instance role
├── helm/wc2026/ # api + web + sync CronJob + ingress chart (cluster-agnostic)
└── gitops/      # ArgoCD app-of-apps (dev auto-sync, prod manual promotion)
```

## Cost
| | |
|---|---|
| EC2 t4g.small (2 GB) | ~$12/mo (or t4g.medium ~$24 for comfy dev+prod+ArgoCD) |
| Elastic IP (attached) | free |
| DynamoDB on-demand + SSM | pennies |
| **Total** | **~$12–24/mo** — destroy with `terraform destroy` when not needed |

## Deploy
### 0. Build & publish images (GHCR, public)
Push to `main` triggers `.github/workflows/ci.yml`, which builds `ghcr.io/joyaroin/wc2026-api:dev` + `:wc2026-web:dev`. **One-time:** in GitHub → Packages, set both packages to **Public** (so k3s can pull without credentials).

### 1. Provision (Terraform)
```bash
cd infra/terraform/environments/aws
export TF_VAR_football_data_token=<your-football-data-token>   # goes into SSM, not git
terraform init
terraform apply        # EC2 + DynamoDB ×2 + SSM + IAM (~2-3 min; node self-bootstraps k3s+ArgoCD over ~5-10 min)
terraform output       # note public_ip, app_url_dev, app_url_prod
```

### 2. Point the chart at your IP
Edit `infra/helm/wc2026/values-dev.yaml` (and `values-prod.yaml`): replace `REPLACE-EIP` in `ingress.host` and `ALLOWED_ORIGIN` with the dashed EIP from `terraform output` (e.g. `dev.52-1-2-3.nip.io`). Commit + push — ArgoCD auto-syncs **dev**.

### 3. Use it
- App: `http://dev.<eip>.nip.io`
- ArgoCD UI: `kubectl port-forward svc/argocd-server -n argocd 8080:443` then https://localhost:8080 (user `admin`, password: `kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath='{.data.password}' | base64 -d`).
- Shell into the node: `aws ssm start-session --target <instance-id>` (no SSH key needed).

## Promotion (dev → prod)
Pin a built image SHA in `values-prod.yaml` (`image.api.tag` / `web.tag`), set `ingress.host`, push to a `release` branch, then **Sync** the `wc2026-prod` Application in ArgoCD.

## HTTPS later
Add a real domain (Route53 or any DNS) → point it at the EIP → install cert-manager and set `ingress.tls.enabled=true` + `certManager.clusterIssuer` in values.

## Local verification (no AWS)
```bash
helm lint infra/helm/wc2026 -f infra/helm/wc2026/values-dev.yaml
helm template wc2026 infra/helm/wc2026 -f infra/helm/wc2026/values-dev.yaml
terraform -chdir=infra/terraform/environments/aws init -backend=false && terraform validate
```

## Teardown
`terraform destroy` (removes the EC2 node + tables + SSM). ~$0 after.
