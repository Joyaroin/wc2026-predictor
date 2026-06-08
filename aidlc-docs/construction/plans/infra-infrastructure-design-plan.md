# Infrastructure Design Plan — Unit `infra`

Maps the logical components (NFR design) to concrete AWS services. Already decided: AWS **serverless** — Lambda + API Gateway + **DynamoDB** + S3/CloudFront + Secrets Manager + EventBridge + CloudWatch. A few deployment choices remain.

---

## Part A: Questions

### Question 1 — Infrastructure-as-Code tool
How should the AWS resources be defined?

A) **AWS CDK (TypeScript)** — same language as the app; `NodejsFunction` bundles Lambdas with esbuild (recommended; fits the monorepo)
B) AWS SAM (YAML)
C) Terraform
X) Other (please describe after [Answer]: tag below)

[Answer]:C

### Question 2 — Environments
How many deployment environments to define now?

A) **Single `prod` stack** to start (simplest; add envs later) (recommended)
B) `dev` + `prod` stacks (parameterized) from the start
X) Other (please describe after [Answer]: tag below)

[Answer]:B

### Question 3 — API Gateway type
Which API Gateway flavor in front of the API Lambda?

A) **HTTP API** — cheaper, lower latency, built-in CORS; enough for this REST app (recommended)
B) REST API — more features (usage plans, API keys, request validation) but pricier
X) Other (please describe after [Answer]: tag below)

[Answer]:A

### Question 4 — DynamoDB durability
Backup posture for the table?

A) **On-demand + Point-in-Time Recovery (PITR) enabled** — cheap insurance against accidental data loss (recommended)
B) On-demand, no PITR (cheapest)
X) Other (please describe after [Answer]: tag below)

[Answer]:A

---

## Part B: Artifacts (generated after Part A)

- [x] `construction/infra/infrastructure-design/infrastructure-design.md` — logical→AWS service mapping, security mapping (SECURITY-01/02/06/07/14), IAM least-privilege
- [x] `construction/infra/infrastructure-design/deployment-architecture.md` — stack/resource topology, build & deploy flow, data flow, custom-domain note

## Answers: Q1=C (Terraform — overrides earlier CDK assumption), Q2=B (dev + prod), Q3=A (HTTP API), Q4=A (PITR). No contradictions.

## Note
Custom domain/TLS certs are out of scope for v1 — use the default CloudFront + API Gateway HTTPS domains. (Mention if you want a custom domain.)
