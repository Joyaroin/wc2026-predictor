# NFR Requirements Plan — Unit `backend`

Determine non-functional requirements + finalize the backend tech stack.

---

## Part A: Questions

### Question 1 — Local development persistence
How should the backend persist data when running locally (so you can run it without AWS)?

A) **Pluggable repository interface with an in-memory implementation for local dev** + a DynamoDB implementation for AWS (recommended — run instantly, no Docker; same code path swaps by config)
B) DynamoDB Local (Docker) for local dev (closest to prod, needs Docker)
C) Always talk to a real AWS DynamoDB table (needs AWS creds even locally)
X) Other (please describe after [Answer]: tag below)

[Answer]:B

### Question 2 — Express → Lambda adapter
The app is Express but deploys to Lambda. How to bridge?

A) **`@codegenie/serverless-express`** adapter — keep one Express app; `app.ts` runs locally via `app.listen`, `lambda.ts` wraps it for API Gateway (recommended)
B) AWS Lambda Web Adapter (container/layer) running Express unchanged
C) Rewrite handlers as native Lambda (no Express)
X) Other (please describe after [Answer]: tag below)

[Answer]:A

### Question 3 — Security middleware libraries
For headers, CORS, and rate limiting:

A) **`helmet` (headers) + `cors` + `express-rate-limit`** — well-vetted, minimal (recommended; satisfies SECURITY-04/08/11)
B) Hand-rolled middleware (no extra deps)
X) Other (please describe after [Answer]: tag below)

[Answer]:A

### Question 4 — Expected scale (capacity & cost)
What scale should we design/provision for?

A) **Small — friends groups, up to a few thousand players total**; DynamoDB **on-demand** billing, no provisioned capacity (recommended — cheapest, scales automatically)
B) Medium — tens of thousands of players (still on-demand, add caching)
C) Large — plan for viral scale (provisioned capacity + caching + CDN tuning)
X) Other (please describe after [Answer]: tag below)

[Answer]:A

---

## Part B: NFR Artifacts (generated after Part A)

- [x] `construction/backend/nfr-requirements/nfr-requirements.md` — scalability, performance, availability, security, reliability, maintainability targets
- [x] `construction/backend/nfr-requirements/tech-stack-decisions.md` — finalized libraries/versions + rationale (incl. PBT-09 fast-check, scrypt, token signing)

## Answers: Q1=B (DynamoDB Local/Docker for dev), Q2=A (@codegenie/serverless-express), Q3=A (helmet+cors+express-rate-limit), Q4=A (small, on-demand). Unambiguous.
