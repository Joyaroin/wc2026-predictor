# Penalty-Shootout Winner Prediction — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let players who predict a draw on a knockout match also pick the penalty-shootout winner, worth +5 points (Joker-doubled) when correct.

**Architecture:** Add an optional `penWinner` to the match `Prediction`. A pure `penaltyWinnerPoints()` in the shared scoring engine awards +5 keyed on `Match.winner` (which already carries the shootout result). The +5 is folded into persisted points (server) so leaderboard totals and the Joker multiplier pick it up for free; the web `MatchCard` gains a draw-only knockout picker and a receipt row.

**Tech Stack:** TypeScript monorepo (`packages/shared`, `api`, `web`), Zod schemas, Vitest, React 19.

## Global Constraints

- Pure scoring only in `packages/shared/src/scoring.ts` — no I/O, clock, or randomness.
- Pen bonus applies to knockout stages only (`stage !== 'GROUP_STAGE'`); group draws never qualify.
- The pen pick is optional; absence earns 0, never blocks saving a prediction.
- `penWinner` is `'HOME' | 'AWAY' | null` (type `BracketSide`), never `'DRAW'`.
- Run all commands from the repo root. Verify with `npm test`, `npm run typecheck --workspace @wc2026/web`, and `npm run build --workspace @wc2026/shared` (shared must be built before web/api typecheck picks up new exports).

---

### Task 1: `penWinner` on the Prediction type + schemas

**Files:**
- Modify: `packages/shared/src/types.ts` (Prediction interface)
- Modify: `packages/shared/src/schemas.ts` (`predictionInputSchema`, `predictionSchema`)
- Test: `packages/shared/test/schemas.pbt.test.ts` (round-trip already exercises predictionSchema)

**Interfaces:**
- Produces: `Prediction.penWinner?: BracketSide | null`; both prediction schemas accept an optional nullable `penWinner`.

- [ ] **Step 1: Add the field to the type**

In `packages/shared/src/types.ts`, inside `interface Prediction`, after `firstScorerName`:
```ts
  /** Optional: on a knockout draw prediction, which team wins the shootout (+5 if right). */
  penWinner?: BracketSide | null;
```

- [ ] **Step 2: Add to both schemas**

In `packages/shared/src/schemas.ts`, add this line to the `.object({...})` of **both** `predictionInputSchema` and `predictionSchema` (next to `firstTeam`):
```ts
    penWinner: bracketSideSchema.nullable().optional(),
```

- [ ] **Step 3: Add an explicit round-trip test**

In `packages/shared/test/schemas.pbt.test.ts`, add:
```ts
test('predictionSchema accepts penWinner', () => {
  const base = { playerId: 'p', matchId: 'm', home: 1, away: 1, points: 0, createdAt: 't', updatedAt: 't' };
  expect(predictionSchema.parse({ ...base, penWinner: 'HOME' }).penWinner).toBe('HOME');
  expect(predictionSchema.parse({ ...base, penWinner: null }).penWinner).toBeNull();
  expect(predictionSchema.parse(base).penWinner).toBeUndefined();
});
```
(Ensure `predictionSchema` is imported in that file; add to the existing import if missing.)

- [ ] **Step 4: Build shared + run tests**

Run: `npm run build --workspace @wc2026/shared && npm test --workspace @wc2026/shared`
Expected: PASS (all shared tests, including the new one).

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/types.ts packages/shared/src/schemas.ts packages/shared/test/schemas.pbt.test.ts
git commit -m "feat(shared): add optional penWinner to Prediction"
```

---

### Task 2: `penaltyWinnerPoints()` scoring (the core)

**Files:**
- Modify: `packages/shared/src/scoring.ts`
- Test: `packages/shared/test/scoring.example.test.ts`

**Interfaces:**
- Consumes: `Prediction.penWinner` (Task 1).
- Produces: `PEN_WINNER_POINTS = 5`; `penaltyWinnerPoints(pred, match): number` where
  `pred: { home: number; away: number; penWinner?: BracketSide | null }` and
  `match: { stage: Stage; homeScore: number | null; awayScore: number | null; winner?: Outcome | null }`.

- [ ] **Step 1: Write the failing tests**

Append to `packages/shared/test/scoring.example.test.ts` (add `penaltyWinnerPoints`, `PEN_WINNER_POINTS` to the import from `../src/scoring` — or `../src/index`):
```ts
describe('penaltyWinnerPoints', () => {
  const ko = { stage: 'LAST_16' as const, homeScore: 1, awayScore: 1, winner: 'HOME' as const };
  it('+5 when draw predicted and shootout winner correct', () => {
    expect(penaltyWinnerPoints({ home: 1, away: 1, penWinner: 'HOME' }, ko)).toBe(5);
    expect(penaltyWinnerPoints({ home: 0, away: 0, penWinner: 'HOME' }, ko)).toBe(5); // any draw scoreline
  });
  it('0 when shootout winner wrong', () => {
    expect(penaltyWinnerPoints({ home: 1, away: 1, penWinner: 'AWAY' }, ko)).toBe(0);
  });
  it('0 when no pen winner picked', () => {
    expect(penaltyWinnerPoints({ home: 1, away: 1, penWinner: null }, ko)).toBe(0);
  });
  it('0 when a decisive result was predicted (the 2-0-but-pens case)', () => {
    expect(penaltyWinnerPoints({ home: 2, away: 0, penWinner: 'HOME' }, ko)).toBe(0);
  });
  it('0 when the match did not go to pens (decisive result)', () => {
    expect(penaltyWinnerPoints({ home: 1, away: 1, penWinner: 'HOME' }, { stage: 'FINAL', homeScore: 2, awayScore: 1, winner: 'HOME' })).toBe(0);
  });
  it('0 for group stage even on a level scoreline', () => {
    expect(penaltyWinnerPoints({ home: 1, away: 1, penWinner: 'HOME' }, { stage: 'GROUP_STAGE', homeScore: 1, awayScore: 1, winner: 'DRAW' })).toBe(0);
  });
  it('0 when winner not yet decided', () => {
    expect(penaltyWinnerPoints({ home: 1, away: 1, penWinner: 'HOME' }, { stage: 'LAST_16', homeScore: null, awayScore: null, winner: null })).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test --workspace @wc2026/shared -- scoring.example`
Expected: FAIL — `penaltyWinnerPoints is not a function`.

- [ ] **Step 3: Implement**

In `packages/shared/src/scoring.ts`: add `Stage` to the type import (`import type { Score, Outcome, StandingAgg, BracketSide, Stage } from './types';`) and append:
```ts
/** Bonus for correctly calling the penalty-shootout winner on a knockout draw prediction. */
export const PEN_WINNER_POINTS = 5;

/** +5 only when: the match went to pens (knockout, level FT score, a HOME/AWAY winner),
 *  the player predicted a draw, and their penWinner matches the actual shootout winner. */
export function penaltyWinnerPoints(
  pred: { home: number; away: number; penWinner?: BracketSide | null },
  match: { stage: Stage; homeScore: number | null; awayScore: number | null; winner?: Outcome | null },
): number {
  const wentToPens =
    match.stage !== 'GROUP_STAGE' &&
    match.homeScore != null &&
    match.awayScore != null &&
    match.homeScore === match.awayScore &&
    (match.winner === 'HOME' || match.winner === 'AWAY');
  const predictedDraw = pred.home === pred.away;
  return wentToPens && predictedDraw && pred.penWinner != null && pred.penWinner === match.winner
    ? PEN_WINNER_POINTS
    : 0;
}
```
Confirm both symbols are re-exported from `packages/shared/src/index.ts` (it re-exports `./scoring`; add explicit names there only if it uses a named allowlist).

- [ ] **Step 4: Build + run**

Run: `npm run build --workspace @wc2026/shared && npm test --workspace @wc2026/shared -- scoring.example`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/scoring.ts packages/shared/src/index.ts packages/shared/test/scoring.example.test.ts
git commit -m "feat(shared): penaltyWinnerPoints (+5 for correct shootout call)"
```

---

### Task 3: Persist `penWinner` through the API

**Files:**
- Modify: `api/src/services/predictions.ts` (`PredictionInput`, `upsert`)
- Modify: `api/src/repos/mappers.ts` (`predictionToItem`, `predictionFromItem`)
- Test: `api/test/integration/predict.flow.test.ts`

**Interfaces:**
- Consumes: `predictionInputSchema.penWinner` (Task 1) via the existing route `PUT /predictions/:matchId`.
- Produces: a saved `Prediction` whose `penWinner` round-trips through repos.

- [ ] **Step 1: Write the failing test**

In `api/test/integration/predict.flow.test.ts`, add a case that saves and reads back a pen winner (follow the file's existing harness for auth + request helpers):
```ts
it('persists penWinner on a draw prediction', async () => {
  // ...existing setup to get an authed player + a knockout matchId...
  await put(`/predictions/${koMatchId}`, { home: 1, away: 1, penWinner: 'HOME' }, token);
  const list = await get('/predictions', token);
  expect(list.find((p: any) => p.matchId === koMatchId).penWinner).toBe('HOME');
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test --workspace @wc2026/api -- predict.flow`
Expected: FAIL — `penWinner` is `undefined` (not persisted yet).

- [ ] **Step 3: Implement the input + upsert**

In `api/src/services/predictions.ts`: add to `interface PredictionInput` (next to `firstTeam`):
```ts
  penWinner?: BracketSide | null;
```
In `upsert`, in the object built for `predictions.put`, after the `firstScorerName` line:
```ts
        penWinner: input.penWinner !== undefined ? input.penWinner : (existing?.penWinner ?? null),
```

- [ ] **Step 4: Implement the repo mappers**

In `api/src/repos/mappers.ts`:
- `predictionToItem`: after `firstScorerName: p.firstScorerName ?? null,` add `penWinner: p.penWinner ?? null,`
- `predictionFromItem`: after the `firstScorerName` line add
  `penWinner: (item.penWinner ?? null) as Prediction['penWinner'],`

(The in-memory repo stores whole `Prediction` objects, so it needs no change.)

- [ ] **Step 5: Run to verify pass**

Run: `npm test --workspace @wc2026/api -- predict.flow`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add api/src/services/predictions.ts api/src/repos/mappers.ts api/test/integration/predict.flow.test.ts
git commit -m "feat(api): persist penWinner through upsert + repos"
```

---

### Task 4: Award the +5 in the scoring service

**Files:**
- Modify: `api/src/services/scoring.ts`
- Test: `api/test/services/scoring.test.ts`

**Interfaces:**
- Consumes: `penaltyWinnerPoints` (Task 2), persisted `penWinner` (Task 3).
- Produces: `scoreMatch` includes +5 in `prediction.points` when earned.

- [ ] **Step 1: Write the failing test**

In `api/test/services/scoring.test.ts`, add (mirroring the file's existing repo/setup helpers):
```ts
it('adds +5 for a correct penalty-winner call on a knockout draw', async () => {
  // a LAST_16 match that finished 1-1 with winner HOME (shootout)
  await matches.put({ ...koMatch, homeScore: 1, awayScore: 1, winner: 'HOME', status: 'FINISHED' });
  await predictions.put({ playerId: 'a', matchId: koMatch.id, home: 1, away: 1, penWinner: 'HOME', points: 0, createdAt: 't', updatedAt: 't' });
  await svc.scoreMatch(koMatch.id);
  const p = await predictions.get('a', koMatch.id);
  // exact 1-1 scoreline (12) + pen (5) = 17
  expect(p!.points).toBe(17);
});
it('no pen points for a decisive prediction even if that team won pens', async () => {
  await matches.put({ ...koMatch, homeScore: 1, awayScore: 1, winner: 'HOME', status: 'FINISHED' });
  await predictions.put({ playerId: 'b', matchId: koMatch.id, home: 2, away: 0, penWinner: 'HOME', points: 0, createdAt: 't', updatedAt: 't' });
  await svc.scoreMatch(koMatch.id);
  expect((await predictions.get('b', koMatch.id))!.points).toBe(0);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test --workspace @wc2026/api -- services/scoring`
Expected: FAIL — points are 12 (no pen bonus yet).

- [ ] **Step 3: Implement**

In `api/src/services/scoring.ts`: add `penaltyWinnerPoints` to the shared import, and in the per-prediction loop change the points line:
```ts
        const pen = penaltyWinnerPoints(p, match);
        const points = bd.points + fg.firstTeam + fg.firstPlayer + pen;
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test --workspace @wc2026/api -- services/scoring`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/src/services/scoring.ts api/test/services/scoring.test.ts
git commit -m "feat(api): score +5 for correct penalty-winner prediction"
```

---

### Task 5: Surface the pen result in the breakdown (My Results receipt)

**Files:**
- Modify: `api/src/services/dtos.ts` (`PointsBreakdown`)
- Modify: `api/src/services/leaderboard.ts` (`buildBreakdown`)
- Test: `api/test/integration/leaderboard.flow.test.ts`

**Interfaces:**
- Produces: `PointsBreakdown.penWinner: { picked: 'HOME' | 'AWAY'; hit: boolean | null } | null`.

- [ ] **Step 1: Write the failing test**

In `api/test/integration/leaderboard.flow.test.ts`, after a knockout match finishes 1-1 winner HOME and the player predicted 1-1 + penWinner HOME, assert the breakdown row:
```ts
expect(row.breakdown.penWinner).toEqual({ picked: 'HOME', hit: true });
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test --workspace @wc2026/api -- leaderboard.flow`
Expected: FAIL — `penWinner` undefined on breakdown.

- [ ] **Step 3: Implement the DTO**

In `api/src/services/dtos.ts`, in `interface PointsBreakdown`, after `firstScorer`:
```ts
  penWinner: { picked: 'HOME' | 'AWAY'; hit: boolean | null } | null;
```

- [ ] **Step 4: Implement in buildBreakdown**

In `api/src/services/leaderboard.ts`: import `penaltyWinnerPoints`, and inside the `breakdown = {...}` object add:
```ts
          penWinner: pred.penWinner
            ? { picked: pred.penWinner, hit: m.winner != null ? penaltyWinnerPoints(pred, m) > 0 : null }
            : null,
```

- [ ] **Step 5: Run to verify pass**

Run: `npm test --workspace @wc2026/api -- leaderboard.flow`
Expected: PASS. Then full API suite: `npm test --workspace @wc2026/api` (expect green).

- [ ] **Step 6: Commit**

```bash
git add api/src/services/dtos.ts api/src/services/leaderboard.ts api/test/integration/leaderboard.flow.test.ts
git commit -m "feat(api): expose penWinner hit in points breakdown"
```

---

### Task 6: Web API client types

**Files:**
- Modify: `web/src/api/client.ts` (`upsertPrediction` body, `PointsBreakdown`)

**Interfaces:**
- Consumes: server `PointsBreakdown.penWinner` (Task 5).
- Produces: `upsertPrediction` accepts `penWinner`; client `PointsBreakdown` has `penWinner`.

- [ ] **Step 1: Extend the request body**

In `web/src/api/client.ts`, `upsertPrediction`'s `body` type — add `penWinner?: 'HOME' | 'AWAY' | null;`.

- [ ] **Step 2: Extend client PointsBreakdown**

In the `PointsBreakdown` interface, after `firstScorer`, add:
```ts
  penWinner: { picked: 'HOME' | 'AWAY'; hit: boolean | null } | null;
```

- [ ] **Step 3: Verify types compile**

Run: `npm run build --workspace @wc2026/shared && npm run typecheck --workspace @wc2026/web`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add web/src/api/client.ts
git commit -m "feat(web): penWinner in api client types"
```

---

### Task 7: FixturesPage — pen-winner mutation + clear-on-non-draw

**Files:**
- Modify: `web/src/pages/FixturesPage.tsx`

**Interfaces:**
- Consumes: `api.upsertPrediction(..., { penWinner })` (Task 6).
- Produces: `onPenWinner(matchId, side)` passed to `MatchCard` (Task 8); saving a non-draw scoreline sends `penWinner: null`.

- [ ] **Step 1: Add the mutation**

Mirror the existing `firstTeam` mutation. Add near it:
```ts
  const penWinner = useMutation({
    mutationFn: ({ matchId, home, away, side }: { matchId: string; home: number; away: number; side: 'HOME' | 'AWAY' | null }) =>
      api.upsertPrediction(matchId, { home, away, penWinner: side }),
    onMutate: async ({ matchId, side }) => {
      await qc.cancelQueries({ queryKey: [...PREDS] });
      const prev = patchPreds(qc, (old) => old.map((p) => (p.matchId === matchId ? { ...p, penWinner: side } : p)));
      return { prev };
    },
    ...common,
  });
```

- [ ] **Step 2: Clear penWinner when the saved scoreline is not a draw**

In the `save` mutation's `mutationFn`, send `penWinner: null` when the score is decisive so stale picks don't linger:
```ts
    mutationFn: ({ matchId, home, away }: { matchId: string; home: number; away: number }) =>
      api.upsertPrediction(matchId, { home, away, ...(home !== away ? { penWinner: null } : {}) }),
```
(And in its `onMutate` `patchPreds`, when `home !== away` set `penWinner: null` on the patched prediction.)

- [ ] **Step 3: Pass the handler to MatchCard**

In the `<MatchCard .../>` props, add:
```tsx
                        onPenWinner={(matchId, side) => {
                          const p = predByMatch.get(matchId);
                          if (p) penWinner.mutate({ matchId, home: p.home, away: p.away, side });
                        }}
```

- [ ] **Step 4: Verify (typecheck will fail until Task 8 adds the prop — expected)**

Run: `npm run typecheck --workspace @wc2026/web`
Expected: FAIL only on `onPenWinner` not being a known MatchCard prop — resolved by Task 8. (If you prefer green-between-tasks, do Step 1 of Task 8 first.)

- [ ] **Step 5: Commit**

```bash
git add web/src/pages/FixturesPage.tsx
git commit -m "feat(web): wire penWinner mutation on Fixtures"
```

---

### Task 8: MatchCard — picker, receipt row, points

**Files:**
- Modify: `web/src/components/MatchCard.tsx`
- Modify: `web/src/styles.css` (reuse `.firstteam-row` / `.bonus-title`; add only if a new class is needed)

**Interfaces:**
- Consumes: `onPenWinner` (Task 7), `penaltyWinnerPoints` (Task 2), `prediction.penWinner`.
- Produces: a knockout draw-only "Wins on penalties" picker; a receipt row.

- [ ] **Step 1: Add the prop**

In `MatchCard`'s `Props`, add: `onPenWinner: (matchId: string, side: 'HOME' | 'AWAY' | null) => void;` and destructure it.

- [ ] **Step 2: Add the picker (inside the `editable` `mc-bonus` block)**

Show only on knockout matches when the saved prediction is a draw. After the "First player to score" block, add:
```tsx
{match.stage !== 'GROUP_STAGE' && prediction && prediction.home === prediction.away && (
  <>
    <div className="mc-divider" />
    <div className="bonus-title">Wins on penalties (+5)</div>
    <div className="firstteam-row">
      <button type="button" className={prediction.penWinner === 'HOME' ? 'firstteam on' : 'firstteam'}
        disabled={saving} title={match.homeTeam}
        onClick={() => onPenWinner(match.id, prediction.penWinner === 'HOME' ? null : 'HOME')}
        data-testid={`pen-home-${match.id}`}>
        <Flag code={match.homeCode} name={match.homeTeam} big />
      </button>
      <button type="button" className={prediction.penWinner === 'AWAY' ? 'firstteam on' : 'firstteam'}
        disabled={saving} title={match.awayTeam}
        onClick={() => onPenWinner(match.id, prediction.penWinner === 'AWAY' ? null : 'AWAY')}
        data-testid={`pen-away-${match.id}`}>
        <Flag code={match.awayCode} name={match.awayTeam} big />
      </button>
    </div>
  </>
)}
```

- [ ] **Step 3: Add the receipt row (in the `bd` receipt block)**

Import `penaltyWinnerPoints, PEN_WINNER_POINTS` from `@wc2026/shared`. Compute near `fg`:
```ts
  const penPts = actualScore && prediction ? penaltyWinnerPoints(prediction, match) : 0;
  const wentToPens = match.stage !== 'GROUP_STAGE' && finished && actualScore?.home === actualScore?.away && (match.winner === 'HOME' || match.winner === 'AWAY');
```
In the receipt `<div className="mc-receipt">`, after the first-scorer row, add:
```tsx
{wentToPens && prediction?.penWinner && rcptRow(
  <>Wins on pens: <Flag code={prediction.penWinner === 'HOME' ? match.homeCode : match.awayCode} name={prediction.penWinner === 'HOME' ? match.homeTeam : match.awayTeam} /></>,
  penPts > 0,
  PEN_WINNER_POINTS,
)}
```

- [ ] **Step 4: Include pen in the live/“as it stands” points**

Where `livePts` is computed, add `penPts` to the bonus sum:
```ts
  const livePts = live && prediction && bd
    ? effectivePoints({ points: bd.points + (fg ? fg.firstTeam + fg.firstPlayer : 0) + penPts, joker: prediction.joker })
    : null;
```
(Final/`scored` points already come from persisted `prediction.points`, which includes the +5 from Task 4 — no change needed there.)

- [ ] **Step 5: Verify**

Run: `npm run build --workspace @wc2026/shared && npm run typecheck --workspace @wc2026/web && npm test --workspace @wc2026/web && npm run build --workspace @wc2026/web`
Expected: typecheck PASS, tests PASS, build PASS.

- [ ] **Step 6: Manual check (run the app)**

Use the `run` skill / `npm run dev`. On a knockout fixture: enter `1-1` → the "Wins on penalties" picker appears; pick a flag → auto-saves; change to `2-1` → picker disappears and the pick clears. (Web has no React component test harness — typecheck/build + this manual pass is the verification.)

- [ ] **Step 7: Commit**

```bash
git add web/src/components/MatchCard.tsx web/src/styles.css
git commit -m "feat(web): penalty-winner picker + receipt on MatchCard"
```

---

## Final verification

- [ ] `npm test` (root — shared + api + web all green)
- [ ] `npm run typecheck --workspace @wc2026/web`
- [ ] `npm run build --workspace @wc2026/web`
- [ ] Manual: knockout draw shows picker & scores +5; decisive prediction on a pens match scores 0; group-stage draw shows no picker.

## Data caveat to resolve during Task 4/manual testing

Confirm football-data.org sets `score.winner` to the **shootout** winner while `fullTime` stays the regulation/ET **draw** (see `api/src/integration/footballApiClient.ts:66`, `WINNER` map). If it folds the shootout into the score (so FT isn't level), `penaltyWinnerPoints`' `homeScore === awayScore` guard would miss it — then either key detection off a provider "penalties" duration flag or fall back to the admin-set pattern used for Player-of-the-Tournament (`api/src/services/playerOfTournament.ts`). Note findings in the PR.
