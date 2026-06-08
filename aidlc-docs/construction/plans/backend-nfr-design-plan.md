# NFR Design Plan — Unit `backend`

## Questions
All resilience/scalability/performance/security patterns are already determined by the approved NFR Requirements and Functional Design (auth model, rate limiting, on-demand DynamoDB, precomputed scoring, resilient sync). **No open clarification questions** for this unit's NFR design.

Categories evaluated:
- Resilience: provider retry/backoff + fail-soft sync — determined. 
- Scalability: stateless Lambda + on-demand DynamoDB — determined (Q4=A).
- Performance: precompute points; warm-client reuse — determined.
- Security: middleware pipeline + auth patterns — determined (Security Baseline).
- Logical components: enumerated below.

## Artifacts (generated)
- [x] `construction/backend/nfr-design/nfr-design-patterns.md`
- [x] `construction/backend/nfr-design/logical-components.md`
