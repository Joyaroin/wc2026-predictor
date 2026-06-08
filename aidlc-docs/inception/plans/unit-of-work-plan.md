# Unit of Work Plan

**Purpose**: Decompose the system into development units of work, map stories to units, and define build order. This is a **monorepo** (not microservices), so units are development modules — the API runs as one service (plus a sync job), the web as a static SPA.

---

## Part A: Decomposition Questions (please answer)

Fill in each `[Answer]:` tag with a letter (or X + description). Say "done" when finished.

### Question 1 — Unit granularity
How many units of work should we split into?

A) **4 units** — `shared` (types + scoring), `backend` (API + domain + persistence + sync), `web` (React SPA), `infra` (AWS IaC) (recommended)
B) **5 units** — split the external-API **integration/sync** out of `backend` into its own unit
C) **2 units** — `backend` (incl. shared + infra) and `web`
X) Other (please describe after [Answer]: tag below)

[Answer]:A

### Question 2 — Build / sequence order
In what order should units be built in the Construction phase?

A) **shared → backend → web → infra** (dependency order; UI builds against a real API; infra last) (recommended)
B) infra first, then shared → backend → web
C) web first against a mocked API, then backend, then infra
X) Other (please describe after [Answer]: tag below)

[Answer]:A

### Question 3 — Per-unit design depth (Construction loop)
The Construction phase runs design stages per unit. How deep per unit?

A) **Targeted** — Functional Design + NFR for `backend` (business logic, scoring, security); Infrastructure Design for `infra`; lighter/skip heavy design for `shared` and `web` (recommended)
B) **Full** — run all design stages (Functional, NFR Requirements, NFR Design, Infrastructure) for every unit
C) **Minimal** — go straight to Code Generation for all units
X) Other (please describe after [Answer]: tag below)

[Answer]:A

---

## Part B: Unit Artifacts (generated after Part A is approved)

- [x] `application-design/unit-of-work.md` — unit definitions, responsibilities, code-organization strategy (greenfield)
- [x] `application-design/unit-of-work-dependency.md` — inter-unit dependency matrix + build order
- [x] `application-design/unit-of-work-story-map.md` — every story (US-*) mapped to a unit
- [x] Validate unit boundaries; confirm all stories assigned; note Security/PBT placement per unit

## Answers (recorded): Q1=A (4 units), Q2=A (shared→backend→web→infra), Q3=A (targeted depth). All unambiguous; no follow-ups.
