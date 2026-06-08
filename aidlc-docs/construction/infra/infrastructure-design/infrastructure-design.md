> ⚠️ **SUPERSEDED (2026-06-08).** This serverless (Lambda/API Gateway/S3/CloudFront) design was **replaced** by a **Kubernetes/EKS + Helm + ArgoCD GitOps** design at the user's request. It is retained here for history. **The active design is in [eks-infrastructure-design.md](eks-infrastructure-design.md) and [eks-deployment-architecture.md](eks-deployment-architecture.md).**

---

# Infrastructure Design — Unit `infra`  *(ARCHIVED — serverless option)*

**IaC**: **Terraform (HCL)** — decision Q1=C (overrides the earlier CDK assumption in unit-of-work.md).
**Environments**: **dev + prod** (Q2=B), via a reusable module instantiated per environment.
**API Gateway**: **HTTP API** (Q3=A). **DynamoDB**: on-demand + **PITR** (Q4=A).
Region: per `aws_region` var (default `us-east-1`). Custom domain/TLS: out of scope for v1 (default CloudFront + API Gateway HTTPS domains).

## Logical component → AWS service mapping
| Logical component (NFR design) | AWS service | Notes |
|---|---|---|
| API Lambda (`api/src/lambda.ts`) | **AWS Lambda** (`nodejs22.x`) | Bundled with esbuild → zip; behind HTTP API |
| Sync job (`api/src/sync.lambda.ts`) | **AWS Lambda** + **EventBridge** rule `rate(10 minutes)` | Manual invoke also possible |
| HTTP routing | **API Gateway HTTP API** | Proxy integration to API Lambda; CORS = CloudFront origin; access logging on |
| DynamoDB single table | **DynamoDB** table `wc2026-<env>` | PK/SK + GSI1 + GSI2; on-demand; PITR; SSE at rest |
| Static SPA (`web/dist`) | **S3** (private) + **CloudFront** | OAC; SPA fallback 403/404→`/index.html`; response-headers policy |
| Secrets (signing key, football token) | **Secrets Manager** | `wc2026/<env>/session-signing-secret`, `wc2026/<env>/football-token` |
| Logs / metrics / alarms | **CloudWatch** | Log groups (90-day retention), alarms, metric filters |
| Identities/permissions | **IAM** roles (least privilege) | One role per Lambda |

## Environment variables injected into the API/Sync Lambdas
`TABLE_NAME`, `AWS_REGION` (provided), `ALLOWED_ORIGIN` (CloudFront URL), `FOOTBALL_COMPETITION=WC`, `PERSISTENCE=dynamo`, `SESSION_TTL_DAYS=30`. Secrets (`SESSION_SIGNING_SECRET`, `FOOTBALL_DATA_TOKEN`) are resolved from Secrets Manager — injected as env at deploy via Terraform data sources, **never committed**.

## Security mapping (Security Baseline — infra-tier rules)
| Rule | How it's satisfied |
|---|---|
| **SECURITY-01** Encryption at rest + in transit | DynamoDB SSE (AWS-managed KMS) + PITR; S3 default SSE; **TLS enforced** everywhere — CloudFront `viewer_protocol_policy=redirect-to-https`, HTTP API is HTTPS-only, S3 bucket policy denies non-TLS (`aws:SecureTransport=false`) |
| **SECURITY-02** Access logging on intermediaries | HTTP API stage **access logs** → CloudWatch; CloudFront standard logging → S3 logs bucket |
| **SECURITY-04** HTTP security headers | CloudFront **response-headers policy**: CSP `default-src 'self'`, HSTS `max-age=31536000; includeSubDomains`, `X-Content-Type-Options=nosniff`, `X-Frame-Options=DENY`, `Referrer-Policy=strict-origin-when-cross-origin` |
| **SECURITY-06** Least-privilege IAM | API Lambda role: DynamoDB actions scoped to the table ARN **and** its index ARNs only; Secrets Manager `GetSecretValue` on the two specific secret ARNs; CloudWatch `CreateLogStream`/`PutLogEvents` only. Sync role similar. **No wildcard actions/resources.** |
| **SECURITY-07** Restrictive network config | Fully managed serverless (no VPC needed — documented). S3 **Block Public Access** on; bucket reachable only via CloudFront **OAC**. No `0.0.0.0/0` ingress except CloudFront/API Gateway public HTTPS endpoints (managed). |
| **SECURITY-09** Hardening / misconfig | No default creds; S3 public access blocked; app already returns generic prod errors; pinned runtimes (`nodejs22.x`) |
| **SECURITY-10** Supply chain | Lambda bundles built from the committed lockfile; CI runs `npm audit`; no `latest` tags |
| **SECURITY-12** Secrets | Signing key + football token in Secrets Manager (encrypted), read at deploy/runtime; never in source/IaC state values committed |
| **SECURITY-14** Alerting & monitoring | CloudWatch **alarms**: Lambda `Errors`, `Throttles`, API Gateway `5xx`; **metric filter** on app log "request rejected"/401 for auth-failure alerting; log group **retention ≥ 90 days**; Lambda roles **lack** `logs:DeleteLogGroup`/`DeleteLogStream` (cannot delete their own audit logs) |

## IAM policy sketch (API Lambda)
```
dynamodb: GetItem,PutItem,UpdateItem,DeleteItem,Query,TransactWriteItems,BatchWriteItem
  on  arn:aws:dynamodb:REGION:ACCT:table/wc2026-<env>
  and arn:aws:dynamodb:REGION:ACCT:table/wc2026-<env>/index/*
secretsmanager: GetSecretValue
  on  the two specific secret ARNs
logs: CreateLogStream, PutLogEvents  (on the function's log group only)
```
(Sync Lambda: same DynamoDB + the football-token secret + logs.)

## Cost posture (small scale, Q4 prior)
On-demand DynamoDB + Lambda + HTTP API + CloudFront — effectively free/cents-per-month at this scale. PITR adds a small per-GB cost (negligible for this dataset).
