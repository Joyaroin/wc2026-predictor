# @wc2026/shared

Domain types, zod validation schemas, and the **pure scoring engine** shared by the backend and web.

## Exports
- **Types**: `Player`, `Group`, `Membership`, `Match`, `Prediction`, `Score`, `StandingAgg`, `Stage`, `MatchStatus`, `Outcome`, `Points`.
- **Scoring** (pure): `outcomeOf(score)`, `computePoints(prediction, actual)`, `compareStandings(a, b)`.
- **Schemas** (zod): `scoreSchema`, `predictionInputSchema`, `playerNameSchema`, `groupNameSchema`, `inviteCodeSchema`, `predictionSchema`, `matchSchema`, …

## Scoring
`computePoints` returns `5` (exact), `3` (correct goal difference), `2` (correct result), or `0` (wrong).
Functions are pure — no I/O, clock, or randomness — so they are deterministic and property-tested.

## Test
```bash
npm test --workspace @wc2026/shared
```
Includes example-based tests and **fast-check** property-based tests (scoring invariants, comparator total-order, schema round-trips).
