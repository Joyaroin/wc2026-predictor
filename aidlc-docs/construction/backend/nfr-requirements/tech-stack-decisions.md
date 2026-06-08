# Tech Stack Decisions — Unit `backend`

All dependencies **pinned to exact versions** (SECURITY-10). Runtime target: Node 22 (Lambda `nodejs22.x`), TypeScript ESM.

## Runtime dependencies
| Package | Version | Why |
|---|---|---|
| `@wc2026/shared` | workspace | domain types, zod schemas, scoring (no duplication) |
| `express` | 4.21.2 | HTTP framework |
| `@codegenie/serverless-express` | 4.16.0 | Express→API Gateway/Lambda adapter (Q2=A) |
| `@aws-sdk/client-dynamodb` | 3.717.0 | DynamoDB client |
| `@aws-sdk/lib-dynamodb` | 3.717.0 | Document client (marshalling) |
| `helmet` | 8.0.0 | security headers (SECURITY-04) |
| `cors` | 2.8.5 | strict CORS allowlist (SECURITY-08) |
| `express-rate-limit` | 7.4.1 | rate limiting (SECURITY-11) |
| `zod` | 3.24.1 | (transitive via shared; also direct for route parsing) |

## Built-in (no dependency) choices
- **PIN hashing**: Node `crypto.scrypt` (adaptive KDF) — salted hash `salt:dk`. Satisfies SECURITY-12 without adding a native bcrypt dep.
- **Session token**: Node `crypto.createHmac('sha256', secret)` → compact `base64url(payload).sig`. Self-contained, no JWT lib; validates signature + `exp`.
- **IDs / invite codes**: `crypto.randomUUID()` and `crypto.randomInt()` (CSPRNG) over alphabet `A-Z2-9`.
- **Structured logging**: minimal JSON logger to stdout (CloudWatch captures), with field redaction for secrets/PII (SECURITY-03). Dependency-free keeps the supply-chain surface small.

## Dev dependencies
| Package | Version | Why |
|---|---|---|
| `typescript` | 5.7.2 | compiler |
| `tsx` | 4.19.2 | run TS locally (`app.ts`) |
| `vitest` | 4.1.8 | test runner (pinned to clear dev-only advisory) |
| `fast-check` | 3.23.1 | property-based testing (PBT-09) |
| `supertest` | 7.0.0 | HTTP integration tests |
| `@types/express` | 5.0.0 | types |
| `@types/cors` | 2.8.17 | types |
| `@types/supertest` | 6.0.2 | types |
| `@types/node` | 22.10.2 | types |

## Local development (Q1=B)
- **DynamoDB Local** (Docker, `amazon/dynamodb-local`) on `http://localhost:8000`; the DynamoDB client uses an `endpoint` override when `DYNAMODB_ENDPOINT` is set.
- `npm run dev` → `tsx watch src/app.ts` (Express `app.listen`), pointed at DynamoDB Local.
- A `docker-compose.yml` (in `api/`) starts DynamoDB Local + a one-shot table-create step.
- **Note**: local dev and repo integration tests require Docker running.

## Configuration (`config.ts`) — fail fast if a required value is missing (US-7.2)
| Key | Env var | Required | Notes |
|---|---|---|---|
| tableName | `TABLE_NAME` | yes | DynamoDB table |
| dynamoEndpoint | `DYNAMODB_ENDPOINT` | no | set for local |
| awsRegion | `AWS_REGION` | yes (on AWS) | |
| footballApiToken | `FOOTBALL_DATA_TOKEN` | yes (for sync) | secret |
| competition | `FOOTBALL_COMPETITION` | no (default `WC`) | |
| tokenSigningSecret | `SESSION_SIGNING_SECRET` | yes | HMAC key (secret) |
| allowedOrigin | `ALLOWED_ORIGIN` | yes | CORS allowlist |
| sessionTtlDays | `SESSION_TTL_DAYS` | no (default 30) | |

## PBT framework (PBT-09)
- **fast-check** with vitest, already established in `shared`; reused here for backend round-trip properties (PBT-02): item⇄domain mappers and token sign/verify.
