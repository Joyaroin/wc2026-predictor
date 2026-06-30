# Penalty Shootout Result Display

**Date:** 2026-06-30
**Status:** Approved design — pending spec review

## Context

Knockout matches decided by penalties now store the correct regulation draw (e.g. `1–1`) with
the shootout winner on `Match.winner` (fixed in the score-ingestion bug). But the actual
**shootout score** (e.g. `3–4` on pens) is discarded, so a finished pens match just reads
`FT 1–1` with no indication it went to penalties or who advanced on the shootout. This adds
that result to the UI.

**Display only — no scoring or prediction change.** Players still only predict *who* wins the
shootout (`penWinner`, +5). There is no prediction of the penalty score and none is being added.

## Requirements

1. For a finished knockout match decided by penalties, show a terse line: the shootout score
   plus the winning team code — e.g. `pens 3–4 MAR`.
2. Show it in three places: the **Fixtures/My-Results match card**, the **match details modal**,
   and the **who-picked-what page** header.
3. Only for matches that actually went to pens; nothing for normal/extra-time results.
4. No change to scoring, predictions, or the `penWinner` bonus.

## Data model

`packages/shared/src/types.ts` — add to `Match`:
```ts
/** Penalty-shootout score (home–away), only set for knockout matches decided by pens. */
penaltyHome?: number | null;
penaltyAway?: number | null;
```

`packages/shared/src/schemas.ts` — add both to `matchSchema`:
```ts
penaltyHome: goalSchema.nullable().optional(),
penaltyAway: goalSchema.nullable().optional(),
```

Ingest in `api/src/integration/footballApiClient.ts` `mapToDomain`: when
`score.duration === 'PENALTY_SHOOTOUT'`, set `penaltyHome = score.penalties?.home ?? null`
(same for away); otherwise `null`. `score.penalties` is already parsed — no new API calls.

Persist via the Dynamo match mappers `matchToItem`/`matchFromItem` in
`api/src/repos/mappers.ts` (the in-memory repo stores whole `Match` objects, so it needs no
change).

## Shared formatter (DRY — one source of truth)

`web/src/lib/format.ts` — `pensLabel(match: MatchView): string | null`:
- Returns `null` when `penaltyHome == null || penaltyAway == null`.
- Otherwise returns `pens ${penaltyHome}–${penaltyAway} ${winnerCode}` where `winnerCode` is
  `homeCode` when `winner === 'HOME'` else `awayCode` (fallback to the home/away code if a code
  is missing). Example: `pens 3–4 MAR`.

All three display sites call this helper, so the wording stays identical.

## Display sites (all use `pensLabel`)

1. `web/src/components/MatchCard.tsx` — the `state === 'Played'` FT line becomes
   `FT 1–1` + (when `pensLabel` is non-null) ` · pens 3–4 MAR`.
2. `web/src/components/MatchCard.tsx` match-details modal header (`mm-title`/`mm-score`) — append
   the same ` · pens 3–4 MAR`.
3. `web/src/pages/MatchPredictionsPage.tsx` — the `mp-head` score area appends the same when set.

## Testing

- shared (`packages/shared/test/schemas.pbt.test.ts`): `matchSchema` round-trip accepts
  `penaltyHome`/`penaltyAway` (add to the match arbitrary like `winner`).
- api (`api/test/integration/footballApiClient.test.ts`): `mapToDomain` populates
  `penaltyHome`/`penaltyAway` from `score.penalties` for a `PENALTY_SHOOTOUT` match, and leaves
  them `null` for a normal/extra-time match.
- web (`web/test/format.test.ts`): `pensLabel` returns `pens 3–4 MAR` for a pens match and
  `null` for a non-pens match (and when codes are missing, falls back gracefully).

## Out of scope

- Any display for non-shootout matches.
- Live/in-progress pens display (football-data only sets `score.penalties` at FINISHED).
- Any change to scoring, the `penWinner` prediction, or the +5 bonus.
