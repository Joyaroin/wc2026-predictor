# NFR Requirements — Unit `backend`

## Scalability
- **NFR-B-S1**: Target small scale — up to a few thousand players, dozens of groups (decision Q4=A).
- **NFR-B-S2**: DynamoDB **on-demand** capacity (auto-scales, pay-per-request) — no provisioned throughput.
- **NFR-B-S3**: Stateless API on Lambda — horizontal scale handled by the platform; no in-memory session state (signed tokens).

## Performance
- **NFR-B-P1**: p95 latency < 500 ms for reads (fixtures, leaderboard) at target scale.
- **NFR-B-P2**: Points are **precomputed on sync**, so leaderboard = O(members) point sums (no per-request scoring).
- **NFR-B-P3**: External provider polled on a 10-minute schedule (not per request) to respect free-tier limits.

## Availability & Reliability
- **NFR-B-A1**: Best-effort availability via managed serverless (multi-AZ); no formal SLA for a casual game.
- **NFR-B-R1**: Sync failures never break reads — last-known fixtures/results remain served; failures logged (NFR-5.1, SECURITY-15).
- **NFR-B-R2**: Global error handler; all external/DB calls wrapped; writes fail closed.

## Security (Security Baseline — app-tier subset enforced in this unit)
- **NFR-B-SEC1**: Input validation via `shared` zod schemas on every endpoint (SECURITY-05).
- **NFR-B-SEC2**: AuthN/AuthZ — name+PIN login, scrypt PIN hash, signed session token validated per request, object-level ownership + group membership checks (SECURITY-08/12).
- **NFR-B-SEC3**: Rate limiting on public endpoints, especially `/auth/login` and `/groups/join` (SECURITY-11).
- **NFR-B-SEC4**: Security headers + strict CORS allowlist (SECURITY-04/08).
- **NFR-B-SEC5**: Structured logging without secrets/PII; generic error bodies (SECURITY-03/09).
- **NFR-B-SEC6**: Secrets (token-signing key, football API key) from config/secrets manager; never in source/logs (SECURITY-12).

## Maintainability & Testability
- **NFR-B-M1**: TypeScript strict; domain types/scoring reused from `@wc2026/shared` (no duplication).
- **NFR-B-M2**: Pure mapping functions (item⇄domain, token sign/verify) unit + property tested (PBT-02) without infrastructure.
- **NFR-B-M3**: HTTP integration tests via supertest; repo integration tests via **DynamoDB Local** (Docker, decision Q1=B).
- **NFR-B-M4**: Dependency vulnerability scan in CI; pinned versions; lockfile committed (SECURITY-10).

## Usability (API)
- **NFR-B-U1**: Consistent JSON error shape `{ error: string }`; appropriate HTTP status codes per the error taxonomy.
