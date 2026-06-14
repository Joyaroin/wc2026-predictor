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
terraform apply        # EC2 + DynamoDB ×2 + SSM + IAM + Route53 A records (~2-3 min; node self-bootstraps k3s+ArgoCD over ~5-10 min)
terraform output       # note public_ip, app_url_dev, app_url_prod, domain_urls
```

### 2. DNS & TLS (already configured)
Terraform creates Route53 A records for the apex (`var.domain`) and `dev.<domain>` pointing at the node's Elastic IP. The chart serves the app on the **custom domain over HTTPS** — `values-dev.yaml`/`values-prod.yaml` already set `ingress.host`, `ALLOWED_ORIGIN`, and `ingress.tls.enabled=true` (cert-manager issues the cert via the `letsencrypt-prod` ClusterIssuer). Commit + push — ArgoCD auto-syncs **dev**.

### 3. Use it
- Dev app: `https://dev.<domain>` · Prod app: `https://<domain>` (see `terraform output app_url_dev` / `app_url_prod`)
- ArgoCD UI (private — not exposed via DNS): `kubectl port-forward svc/argocd-server -n argocd 8080:443` then https://localhost:8080 (user `admin`, password: `kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath='{.data.password}' | base64 -d`).
- Shell into the node: `aws ssm start-session --target <instance-id>` (no SSH key needed).

## Promotion (dev → prod)
Pin a built image SHA in `values-prod.yaml` (`image.api.tag` / `web.tag`), push to a `release` branch, then **Sync** the `wc2026-prod` Application in ArgoCD.

## Local verification (no AWS)
```bash
helm lint infra/helm/wc2026 -f infra/helm/wc2026/values-dev.yaml
helm template wc2026 infra/helm/wc2026 -f infra/helm/wc2026/values-dev.yaml
terraform -chdir=infra/terraform/environments/aws init -backend=false && terraform validate
```

## Teardown
`terraform destroy` (removes the EC2 node + tables + SSM). ~$0 after.
