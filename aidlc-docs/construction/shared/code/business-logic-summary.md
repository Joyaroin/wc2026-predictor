# Code Summary — Unit `shared`

## Files created (application code)
- `package.json` (root) — npm workspaces, Node >=22.
- `tsconfig.base.json`, `.gitignore`, `.nvmrc`, `README.md` (root).
- `packages/shared/package.json` — `@wc2026/shared`; deps `zod@3.24.1`; dev `typescript@5.7.2`, `vitest@4.1.8`, `fast-check@3.23.1` (pinned — SECURITY-10; vitest pinned to 4.1.8 to clear a dev-only esbuild/vite advisory → `npm audit` reports 0 vulnerabilities).
- `packages/shared/tsconfig.json`, `packages/shared/vitest.config.ts`.
- `packages/shared/src/types.ts` — domain types.
- `packages/shared/src/scoring.ts` — `outcomeOf`, `computePoints`, `compareStandings` (pure).
- `packages/shared/src/schemas.ts` — zod schemas + bounds (SECURITY-05).
- `packages/shared/src/index.ts` — public exports.
- `packages/shared/README.md`.

## Tests created
- `test/scoring.example.test.ts` — four tiers + draw cases + tie-break order (PBT-10).
- `test/scoring.pbt.test.ts` — fast-check SP-1..SP-7, TP-1..TP-3 (PBT-03/07/08).
- `test/schemas.pbt.test.ts` — RT-1 prediction/match round-trip (PBT-02).

## Property → test mapping
| Property | Test |
|---|---|
| SP-1 range {0,2,3,5} | scoring.pbt: "SP-1" |
| SP-2/SP-5 exact ⇔ 5 | scoring.pbt: "SP-2/SP-5" |
| SP-3 wrong ⇒ 0 | scoring.pbt: "SP-3" |
| SP-4 correct ⇒ ≥2 | scoring.pbt: "SP-4" |
| SP-6 3 ⇒ same GD | scoring.pbt: "SP-6" |
| SP-7 symmetry | scoring.pbt: "SP-7" |
| TP-1..3 comparator | scoring.pbt: "compareStandings" |
| RT-1 round-trip | schemas.pbt |

## Story traceability
US-5.1 (scoring), US-5.4 (tie-break), US-4.1/4.6 (validation bounds), US-3.2 (data shapes), US-5.2 (engine reuse) — implemented.

## Verification
See completion message for the executed `vitest` result.
