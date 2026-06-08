# Code Generation Plan — Unit `shared`

**Workspace root**: `/Users/adhamsedik/match_worldcup_predictor` (greenfield, monolith monorepo via npm workspaces).
**Unit**: `shared` → `packages/shared`. **Build order position**: 1st (no deps).
**Stories implemented**: US-3.2 (lock-state data shape), US-4.1/4.6 (score validation), US-5.1 (scoring 5/3/2/0), US-5.2 (recompute uses same engine), US-5.4 (tie-break comparator).
**Dependencies**: none. **Consumed by**: `backend`, `web`.
This plan is the single source of truth for `shared` code generation.

---

## Steps

### Step 1 — Monorepo root setup (greenfield) [x]
Create at workspace root:
- `package.json` (npm workspaces: `packages/*`, `api`, `web`, `infra`; `type: module`; pinned versions — SECURITY-10)
- `tsconfig.base.json` (strict TypeScript), `.gitignore`, top-level `README.md`
- `.nvmrc` (pin Node version — SECURITY-10)

### Step 2 — `shared` package scaffold [x]
- `packages/shared/package.json` (name `@wc2026/shared`, exports, scripts: build/test), pinned deps: `zod`; devDeps: `typescript`, `vitest`, `fast-check` (PBT-09).
- `packages/shared/tsconfig.json`, `packages/shared/vitest.config.ts`.

### Step 3 — Business logic generation [x]
Implements BR-1..BR-5.
- `packages/shared/src/types.ts` — Stage, MatchStatus, Outcome, Points, Score, Player, Group, Membership, Match, Prediction, StandingAgg.
- `packages/shared/src/schemas.ts` — zod schemas + bounds (goals 0..30, name lengths, invite-code regex) — SECURITY-05/BR-4.
- `packages/shared/src/scoring.ts` — `outcomeOf`, `computePoints` (5/3/2/0), `compareStandings` (BR-3 incl. alphabetical fallback). Pure.
- `packages/shared/src/index.ts` — public exports.

### Step 4 — Business logic unit testing [x]
- `packages/shared/test/scoring.example.test.ts` — example-based: the four tiers + draw cases (PBT-10).
- `packages/shared/test/scoring.pbt.test.ts` — fast-check properties SP-1..SP-7, TP-1..TP-3 (PBT-03), with domain generators (PBT-07) and seed logging (PBT-08).
- `packages/shared/test/schemas.pbt.test.ts` — RT-1 zod round-trip (PBT-02).

### Step 5 — Business logic summary [x]
- `aidlc-docs/construction/shared/code/business-logic-summary.md` — what was generated, file list, property→test mapping.

### Step 6 — Documentation [x]
- `packages/shared/README.md` — usage of types/schemas/scoring; note purity + PBT.

---

## Story traceability
- [x] US-5.1 scoring · [x] US-5.4 tie-break · [x] US-4.1/4.6 validation bounds · [x] US-3.2 data shapes · [x] US-5.2 (engine reuse)

## Security / PBT in this unit
- 🔒 SECURITY-05 (validation bounds via zod), SECURITY-10 (pinned deps/lockfile, .nvmrc), SECURITY-11 (scoring isolated in its own module).
- 🧪 PBT-02 (round-trip), PBT-03 (invariants), PBT-07 (generators), PBT-08 (shrink/seed), PBT-09 (fast-check).

## Scope
6 steps; ~9 source/test files + root scaffolding. No API/repo/frontend layers (none in this unit).
