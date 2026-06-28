# Penalty-Shootout Winner Prediction

**Date:** 2026-06-28
**Status:** Approved design — pending spec review

## Context

Knockout matches at the World Cup cannot end in a draw — if level after extra time, a
penalty shootout decides who advances. Today the predictor only scores the regulation/ET
scoreline (plus first-team / first-scorer bonuses), so a player who correctly senses a tie
has no way to call the shootout. This feature lets players who predict a **draw** on a
knockout match also pick **which team wins on penalties**, worth **+5 points** when correct.

The intent is to reward reading a tight knockout tie, without adding the complexity of
predicting the shootout score.

## Requirements

1. When a player's predicted scoreline for a **knockout** match is a **draw** (`home === away`),
   show an optional control to pick the **penalty winner** — one of the two teams (never a draw).
2. A correct penalty-winner pick awards **+5 points**, added to the match total (so the **Joker
   doubles it**, like every other point on the card).
3. **No** penalty *score* prediction — only the winning side.
4. The pen bonus is awarded **only** when the player predicted a draw. If a player predicts a
   decisive result (e.g. `2-0 Mexico`) and the match actually goes to pens, they get **no** pen
   bonus — and, because the real regulation result is a draw, they also correctly get no outcome
   points (this already falls out of existing scoreline scoring).
5. The pen pick is **optional**: a knockout draw prediction without a pen winner simply earns no
   +5 (consistent with the existing optional first-scorer pick).
6. The control only applies to knockout stages; group-stage draws are final and never show it.

## Data model

`packages/shared/src/types.ts` — add to `Prediction`:
```ts
/** Optional: on a knockout draw prediction, which team wins the shootout (+5 if right). */
penWinner?: BracketSide | null;
```

`packages/shared/src/schemas.ts` — add `penWinner: bracketSideSchema.nullable().optional()` to
both `predictionInputSchema` and `predictionSchema`.

No `Match` change: `Match.winner` (`'HOME' | 'DRAW' | 'AWAY'`) already holds the advancing/
shootout winner (mapped from football-data.org at `api/src/integration/footballApiClient.ts:66`).

Prediction persistence/serialization must carry the new field: the prediction mappers in
`api/src/repos/dynamo.ts` and `api/src/repos/memory.ts` (and any DTO in `api/src/services/dtos.ts`).

## Scoring

`packages/shared/src/scoring.ts` — add:
```ts
export const PEN_WINNER_POINTS = 5;

/** +5 when the player predicted a draw and called the shootout winner on a match decided by pens. */
export function penaltyWinnerPoints(
  pred: { home: number; away: number; penWinner?: BracketSide | null },
  match: { stage: Stage; homeScore: number | null; awayScore: number | null; winner?: Outcome | null },
): number {
  const wentToPens =
    match.stage !== 'GROUP_STAGE' &&
    match.homeScore != null && match.awayScore != null &&
    match.homeScore === match.awayScore &&
    (match.winner === 'HOME' || match.winner === 'AWAY');
  const predictedDraw = pred.home === pred.away;
  return wentToPens && predictedDraw && pred.penWinner && pred.penWinner === match.winner
    ? PEN_WINNER_POINTS
    : 0;
}
```

Wire the +5 into the match total at **all three** existing call sites that combine
`scoreBreakdown` + `firstGoalPoints`:
- `api/src/services/scoring.ts` (~L29-31) — persisted points.
- `api/src/services/leaderboard.ts` (~L77-78) — live/provisional points.
- `web/src/components/MatchCard.tsx` — display (points bubble, live + final).

It is added before the Joker multiplier (`effectivePoints` already doubles the total).

## Web UI

`web/src/components/MatchCard.tsx`
- Add a "Wins on penalties" picker (two team-flag buttons, mirroring the existing
  **First team to score** block) shown only when `stage !== 'GROUP_STAGE'` **and** the current
  inputs form a draw (`home === away`, both filled). Selecting a side calls a new `onPenWinner`
  handler; auto-saves like the other bonus picks. Hidden/cleared when the score is no longer a
  draw or the stage is group.
- Add a receipt row in the post-match breakdown — "Wins on pens: `<flag>` ✓/✗ +5" — shown only
  for knockout matches decided by pens when the player set a pen winner.

`web/src/pages/FixturesPage.tsx`
- Add a `penWinner` mutation handler alongside `firstTeam`/`firstScorer` (same optimistic
  `patchPreds` + `api.upsertPrediction(matchId, { home, away, penWinner })` pattern). Clear
  `penWinner` automatically if the saved scoreline becomes non-draw.

`web/src/api/client.ts`
- Extend `upsertPrediction`'s payload type to include `penWinner`.

## Edge cases

- **2-0 predicted, actual 1-1 + pens (Mexico):** not a draw prediction → no +5; existing
  `scoreBreakdown` gives 0 outcome → "doesn't get the win." ✓ (explicit test)
- **0-0 predicted + pens:** the existing 0-0 first-team/scorer logic is unaffected; pen +5 stacks
  on top if the winner is called.
- **Predicted draw + pen winner, but match ends decisively (no pens):** `wentToPens` false → no +5.
- **Group-stage draw:** picker never shown; `penaltyWinnerPoints` returns 0 by stage guard.

## Testing

Pure unit/property tests in `packages/shared` (vitest), covering: correct vs incorrect pen call;
draw vs decisive prediction; knockout vs group; the 2-0-but-pens edge case; Joker doubling
(`effectivePoints`); and 0-0 interaction. Plus a server scoring test in `api` that a persisted
prediction's points include the +5.

## Verification / data caveat (resolve during implementation)

Confirm football-data.org reports `score.winner` as the **shootout** winner while keeping
`fullTime` as the regulation/ET **draw** (vs. folding the shootout into the score). If it folds
them in, adjust pen detection or fall back to the existing admin-set pattern used for the
Player-of-the-Tournament winner. Check `api/src/integration/footballApiClient.ts` and the sync.

## Out of scope

- Predicting the penalty shootout score.
- Pen winner for group-stage matches (impossible).
- Any change to the legacy `BracketPick` / "who advances" mechanism.
