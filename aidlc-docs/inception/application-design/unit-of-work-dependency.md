# Unit of Work — Dependencies & Build Order

## Inter-unit dependency matrix

| Unit | Depends on | Depended on by |
|---|---|---|
| `shared` | (none) | `backend`, `web` |
| `backend` | `shared` | `infra` (packaging/deploy), `web` (API contract) |
| `web` | `shared` (types), `backend` (HTTP contract) | `infra` (hosting) |
| `infra` | `backend` (bundles), `web` (build output) | (none) |

**Acyclic**: `shared` has no deps; `backend` → `shared`; `web` → `shared` + backend contract; `infra` packages the built `backend` + `web`. No cycles.

## Build order (Construction per-unit loop)
1. **`shared`** — types + scoring first (everything else imports it).
2. **`backend`** — services/repos/integration/sync against `shared`; runnable locally (DynamoDB Local or in-memory) so the API contract is real.
3. **`web`** — SPA against the real backend contract + shared types.
4. **`infra`** — CDK stacks that deploy the built backend Lambdas and web assets.

## Coordination points
- **API contract** between `backend` and `web`: defined by `shared` DTOs/zod schemas → single source of truth, no drift.
- **Scoring** lives only in `shared`; `backend` precomputes/persists, `web` may preview — same function, no duplication.
- **Config keys** (table name, allowed origin, API key secret ARN, competition code) are produced by `infra` and consumed by `backend` at runtime.

## Per-unit Construction stages (targeted depth)
| Unit | Functional Design | NFR Requirements | NFR Design | Infrastructure Design | Code Generation |
|---|:--:|:--:|:--:|:--:|:--:|
| `shared` | ✓ (scoring + PBT-01) | – | – | – | ✓ |
| `backend` | ✓ | ✓ | ✓ | – | ✓ |
| `web` | – | – | – | – | ✓ |
| `infra` | – | – | – | ✓ | ✓ |

Then **Build and Test** runs once across all units.
