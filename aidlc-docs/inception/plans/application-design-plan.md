# Application Design Plan

**Role**: Software Architect
**Purpose**: Identify components, their methods/interfaces, the service layer, and dependencies. (Detailed business logic comes later in Functional Design.)

---

## Part A: Design Questions (please answer)

Fill in each `[Answer]:` tag with a letter (or X + description). Say "done" when finished.

### Question 1 — API style
What style should the backend API use?

A) **REST/JSON** over HTTP (recommended — simple, maps cleanly to API Gateway + Lambda)
B) GraphQL
X) Other (please describe after [Answer]: tag below)

[Answer]:A

### Question 2 — Language
JavaScript or TypeScript?

A) **TypeScript** across frontend + backend (recommended — typed DynamoDB models and scoring logic; safer refactors; great fast-check support)
B) Plain JavaScript (ES modules)
X) Other (please describe after [Answer]: tag below)

[Answer]:A

### Question 3 — Frontend data/state approach
How should the React app manage server data and state?

A) **TanStack Query (React Query)** for server state + light local state (recommended — caching, refetching fixtures, optimistic prediction saves)
B) Redux Toolkit (+ RTK Query)
C) Plain React Context + fetch
X) Other (please describe after [Answer]: tag below)

[Answer]:A

### Question 4 — When are points computed?
Where/when should match points be calculated?

A) **Precompute on result sync** — when a final score arrives, compute & store each prediction's points; leaderboards just sum stored points (recommended — fast reads, cheap DynamoDB queries)
B) Compute on read — calculate points on the fly each time a leaderboard/breakdown is requested
X) Other (please describe after [Answer]: tag below)

[Answer]:A

### Question 5 — Repository structure
How should the code be organized?

A) **Monorepo** with `web/` (React), `api/` (Express/Lambda + domain logic), `infra/` (IaC), and a shared `packages/shared` for types/scoring (recommended)
B) Separate repos per piece
C) Single flat project (no workspaces)
X) Other (please describe after [Answer]: tag below)

[Answer]:A

---

## Part B: Application Design Artifacts (generated after Part A is approved)

- [x] `application-design/components.md` — components, purpose, responsibilities, interfaces
- [x] `application-design/component-methods.md` — method signatures + I/O types (business rules deferred to Functional Design)
- [x] `application-design/services.md` — service definitions, responsibilities, orchestration
- [x] `application-design/component-dependency.md` — dependency matrix, communication patterns, data flow
- [x] `application-design/application-design.md` — consolidated overview
- [x] Validate completeness/consistency; record Security Baseline + Partial PBT applicability at this stage

## Answers (recorded): Q1=A REST, Q2=A TypeScript, Q3=A TanStack Query, Q4=A precompute-on-sync, Q5=A monorepo. All unambiguous; no follow-ups.
