# infra — Kubernetes / EKS / GitOps

Deploys the WC2026 Predictor to **AWS EKS** with **dev + prod** environments, using **Terraform** (substrate), **Helm** (app), and **ArgoCD** (GitOps).

```
infra/
├── terraform/   # EKS cluster, DynamoDB (per env), ECR, IRSA
├── helm/wc2026/ # api + web + sync CronJob + ingress chart
└── gitops/      # ArgoCD app-of-apps (dev auto-sync, prod promotion)
```

## Prerequisites
- AWS account + credentials, `terraform`, `kubectl`, `helm`, `docker`, and an S3/DynamoDB remote-state backend (recommended).
- An ACM/Let's Encrypt setup for the ingress hostnames (cert-manager).

## 1. Provision the substrate (Terraform)
```bash
cd infra/terraform/environments/cluster
terraform init && terraform apply         # VPC + EKS + ECR (~15-20 min)
terraform output                          # note oidc_provider_arn, oidc_provider, ecr_repository_urls

# Per-env data + IRSA (paste the cluster OIDC outputs into each terraform.tfvars):
cd ../dev  && terraform init && terraform apply
cd ../prod && terraform init && terraform apply
```
Connect kubectl: `aws eks update-kubeconfig --name wc2026 --region us-east-1`.

## 2. Cluster add-ons
Install **ingress-nginx**, **cert-manager**, **ArgoCD**, and (recommended) **external-secrets** via Helm:
```bash
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo add jetstack https://charts.jetstack.io
helm repo add argo https://argoproj.github.io/argo-helm
# (install each; see their docs)
```

## 3. Secrets
Create the app secret in each namespace (or sync from AWS Secrets Manager via external-secrets):
```bash
kubectl create ns wc2026-dev
kubectl -n wc2026-dev create secret generic wc2026-secrets \
  --from-literal=SESSION_SIGNING_SECRET=$(openssl rand -hex 32) \
  --from-literal=FOOTBALL_DATA_TOKEN=<your-football-data-token>
```
(`values-*.yaml` references `secret.existingSecret: wc2026-secrets`.)

## 4. Build & push images
```bash
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <registry>
docker build -f api/Dockerfile -t <registry>/wc2026/api:dev .
docker build -f web/Dockerfile --build-arg VITE_API_URL="" -t <registry>/wc2026/web:dev .
docker push <registry>/wc2026/api:dev && docker push <registry>/wc2026/web:dev
```
Set `image.registry` + tags + `serviceAccount.roleArn` (IRSA) + `ingress.host` in `values-dev.yaml` / `values-prod.yaml`.

## 5. GitOps (ArgoCD)
```bash
kubectl apply -n argocd -f infra/gitops/projects/wc2026.yaml
kubectl apply -n argocd -f infra/gitops/bootstrap/root-app.yaml
```
- **dev** (`wc2026-dev`) auto-syncs `main` — every merge deploys for testing.
- **prod** (`wc2026-prod`) tracks the `release` ref and syncs **manually** — promote by moving `release` (or bumping the pinned tag in `values-prod.yaml`) and clicking **Sync** in the ArgoCD UI.

## Local verification (no AWS)
```bash
helm lint infra/helm/wc2026 -f infra/helm/wc2026/values-dev.yaml
helm template wc2026 infra/helm/wc2026 -f infra/helm/wc2026/values-dev.yaml
terraform -chdir=infra/terraform/environments/dev init -backend=false && terraform validate
docker build -f api/Dockerfile -t wc2026/api:local .
```

## Teardown
`terraform destroy` in `prod`, `dev`, then `cluster` (reverse order).
