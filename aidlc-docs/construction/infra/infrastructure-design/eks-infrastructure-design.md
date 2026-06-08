> 💡 **Compute substrate updated 2026-06-08 → k3s-on-EC2 (cost).** To get public Kubernetes for **~$12/mo** instead of EKS's ~$150, the cluster is now a single **k3s** node on one EC2 instance, with pods reaching DynamoDB via the **EC2 instance role** (not IRSA) and images pulled from **public GHCR** (not ECR). **The workloads, Helm chart, and ArgoCD GitOps below are unchanged** — only the Terraform substrate + the api ServiceAccount auth differ. See `infra/README.md` and `aidlc-docs/construction/infra/code/infra-summary.md`. The EKS mapping below is retained as the higher-end / HA option.

---

# Infrastructure Design — Unit `infra` (Kubernetes / EKS / GitOps)

**Active design** (replaces the archived serverless option).
**Decisions**: All-Kubernetes on **EKS** with **dev + prod** environments; **Terraform** provisions the AWS substrate; **Helm** packages the app; **ArgoCD** does GitOps (dev auto-sync, prod promotion); **real DynamoDB** via **IRSA**; recommended GitOps add-ons (ingress-nginx + cert-manager); images in **ECR**.

## Topology choice
- **One EKS cluster**, two **namespaces**: `wc2026-dev` and `wc2026-prod` (cost-effective; stronger isolation via two clusters is a documented option).
- Each environment has its **own DynamoDB table** (`wc2026-dev`, `wc2026-prod`) and its **own IRSA role** (pods in that namespace can touch only their env's table).

## Workloads (per environment, via Helm)
| Workload | Kind | Image | Notes |
|---|---|---|---|
| API | Deployment + Service | `api` (Node, runs `app.ts` Express server) | replicas 2 (prod) / 1 (dev); liveness/readiness `/health`; IRSA ServiceAccount |
| Web | Deployment + Service | `web` (nginx serving `web/dist`) | SPA fallback; static only |
| Sync | CronJob | `api` image, cmd `node dist/sync.cjs` | `schedule: */10 * * * *`; reads football token |
| Ingress | Ingress (ingress-nginx) | — | host per env; `/api`→API svc, `/`→Web svc; TLS via cert-manager |

> The app already supports running as a long-lived server (`api/src/app.ts` → `app.listen`) and `PERSISTENCE=dynamo` — so no business-logic changes are needed; only container packaging + a small CronJob runner entry.

## Logical component → infrastructure mapping
| Logical component | Kubernetes / AWS |
|---|---|
| API server | Deployment (api image) behind ClusterIP Service + Ingress |
| Sync job | CronJob (api image) every 10 min |
| Static web | Deployment (nginx) + Service + Ingress |
| Data store | **AWS DynamoDB** (managed) — table per env; accessed via IRSA |
| Secrets (signing key, football token) | Kubernetes `Secret` per namespace (optionally synced from AWS Secrets Manager via external-secrets) |
| Cluster / nodes / networking | **EKS** + managed node group + VPC (Terraform) |
| Image registry | **ECR** repos `wc2026/api`, `wc2026/web` (Terraform) |
| TLS certificates | **cert-manager** (Let's Encrypt) |
| Ingress / LB | **ingress-nginx** (→ AWS NLB) |
| GitOps delivery | **ArgoCD** app-of-apps watching this repo |
| Observability | CloudWatch Container Insights + Fluent Bit; ArgoCD UI for de/sync state |

## Terraform substrate (what TF provisions)
- **VPC** (public + private subnets, NAT) — or reuse default; **EKS cluster** + OIDC provider; **managed node group** (private subnets).
- **DynamoDB** ×2 (`wc2026-dev`, `wc2026-prod`): single-table schema (PK/SK + GSI1 + GSI2), on-demand, **PITR**, **SSE**.
- **ECR** ×2 (api, web) with scan-on-push.
- **IRSA** ×2: IAM roles for the `api` ServiceAccount in each namespace, scoped to that env's table ARN + `index/*` only.
- (Optional bootstrap) ArgoCD, ingress-nginx, cert-manager via the Terraform `helm` provider — or installed as cluster add-ons.

## Security mapping (Security Baseline — K8s/EKS context)
| Rule | How satisfied |
|---|---|
| **SECURITY-01** Encrypt at rest/in transit | DynamoDB SSE + PITR (TF); **TLS** at ingress via cert-manager; EKS secrets envelope-encryption (KMS) enabled |
| **SECURITY-02** Access logging | ingress-nginx access logs → stdout/CloudWatch; NLB access logs (optional) |
| **SECURITY-03** App logging | app → stdout (structured JSON) → Fluent Bit → CloudWatch |
| **SECURITY-04** Security headers | `helmet` in app + ingress annotation backup (CSP/HSTS/…) |
| **SECURITY-06** Least privilege | **IRSA** per env scoped to its DynamoDB table/index ARNs only; **no static AWS keys** in pods; node role minimal |
| **SECURITY-07** Restrictive network | nodes in **private subnets**; only ingress LB exposes 80/443; **NetworkPolicies** restrict pod-to-pod (default-deny + allow api↔web↔dns); ECR pulled over private endpoint (optional) |
| **SECURITY-09** Hardening | minimal/distroless base images, **non-root**, `readOnlyRootFilesystem`, dropped Linux capabilities, resource limits, no default creds |
| **SECURITY-10** Supply chain | base images pinned by **digest**; **ECR scan-on-push**; `npm audit` + image scan in CI; no `latest` tags (deploy by git SHA) |
| **SECURITY-12** Secrets | K8s `Secret` (or external-secrets from AWS Secrets Manager); signing key + football token never baked into images or committed |
| **SECURITY-14** Alerting & monitoring | CloudWatch Container Insights + alarms (pod restarts, 5xx, CronJob failures); log retention ≥90d; ArgoCD surfaces drift/sync health |

## Container hardening baseline (both images)
- Non-root user, `runAsNonRoot: true`, `readOnlyRootFilesystem: true`, `allowPrivilegeEscalation: false`, drop `ALL` capabilities.
- Resource `requests`/`limits`; liveness/readiness probes; `securityContext` at pod + container.
