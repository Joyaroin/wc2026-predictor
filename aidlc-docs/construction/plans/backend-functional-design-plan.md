# Functional Design Plan — Unit `backend`

**Unit**: `backend` (api/) — REST API, services, DynamoDB repos, external-API integration, sync + scoring orchestration, security middleware.
**Stories**: US-1.x, US-2.x, US-3.x, US-4.x, US-5.x, US-6.x, US-7.x (server-side logic).
**Depends on**: `@wc2026/shared`.

A few decisions shape the business logic. Please answer.

---

## Part A: Questions

### Question 1 — Football data provider
Which free/low-cost API should the sync integrate with?

A) **football-data.org** — free tier, has the World Cup competition (`WC`), simple REST + token header (recommended)
B) API-Football (API-Sports) — larger free? (100 req/day), more complex
C) I'll choose later — design the client behind an interface so the provider is swappable (still need a default)
X) Other (please describe after [Answer]: tag below)

[Answer]:A

### Question 2 — Identity / ownership model (no accounts)
There are no passwords. How should we treat a player's identity for authorization (SECURITY-08)?

A) **Player ID is an unguessable capability token** (UUID v4) sent as `X-Player-Id`; whoever holds it acts as that player. Ownership = matching ID. Simple, no passwords, IDs never shown to others. (recommended)
B) Issue a **separate secret token** per player (distinct from the public player ID) used for write auth; the ID can be public, the token cannot
C) Fully open — any client may claim any player ID (no ownership enforcement)
X) Other (please describe after [Answer]: tag below)

[Answer]: can we make it so that the player id is dependant on a 4 digit pin that they input

### Question 3 — Sync cadence + manual refresh
How often should results/fixtures sync, and is a manual trigger allowed?

A) **Every 10 minutes** via schedule, plus an internal manual-refresh trigger (not publicly exposed) (recommended)
B) Every 5 minutes
C) Every 15 minutes
X) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## Part B: Functional Design Artifacts (generated after Part A)

- [x] `construction/backend/functional-design/domain-entities.md` — backend view of entities + DynamoDB single-table key design
- [x] `construction/backend/functional-design/business-rules.md` — auth (name+PIN), lock enforcement (server clock), ownership, pre/post-lock visibility, invite-code generation, sync mapping & rescoring, error taxonomy
- [x] `construction/backend/functional-design/business-logic-model.md` — REST surface + service flows (login, predict, view-match, leaderboard, sync) + PBT-01 notes (DTO/token round-trips)
- [x] No frontend-components.md (backend has no UI)

## Answers: Q1=A (football-data.org), Q2 → clarified, Q3=A (10-min sync).
## Clarifications: CQ1=A (name+PIN identity, cross-device), CQ2=A (unique names), CQ3=B (hash PIN + basic rate limit, accept 4-digit). requirements.md FR-1 + SECURITY-12 updated accordingly.
