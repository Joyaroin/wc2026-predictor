# Penalty Shootout Result Display — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the penalty-shootout score (e.g. `pens 3–4 MAR`) on finished knockout matches decided by pens.

**Architecture:** Store `penaltyHome`/`penaltyAway` on the `Match` (populated from `score.penalties`, already parsed at ingest). Render a terse line via one shared `pensLabel()` helper reused in three places. Display only — no scoring or prediction change.

**Tech Stack:** TypeScript monorepo (`packages/shared`, `api`, `web`), Zod, Vitest, React 19.

## Global Constraints

- Display only: **no** change to scoring, predictions, or the `penWinner` +5 bonus.
- Pens line shows only when both `penaltyHome` and `penaltyAway` are set (knockout shootout, FINISHED).
- Use the en-dash `–` (U+2013) in scores, matching the app's existing score style.
- Build `@wc2026/shared` before api/web typecheck. Verify with `npm test`, `npm run typecheck --workspace @wc2026/web`.

---

### Task 1: `penaltyHome`/`penaltyAway` on the Match type + schema

**Files:**
- Modify: `packages/shared/src/types.ts` (Match interface)
- Modify: `packages/shared/src/schemas.ts` (`matchSchema`)
- Test: `packages/shared/test/schemas.pbt.test.ts`

**Interfaces:**
- Produces: `Match.penaltyHome?: number | null`, `Match.penaltyAway?: number | null`; `matchSchema` accepts both.

- [ ] **Step 1: Add the fields to the type**

In `packages/shared/src/types.ts`, in `interface Match`, after `winner?: Outcome | null;`:
```ts
  /** Penalty-shootout score (home–away); only set for knockout matches decided by pens. */
  penaltyHome?: number | null;
  penaltyAway?: number | null;
```

- [ ] **Step 2: Add to matchSchema**

In `packages/shared/src/schemas.ts`, in `matchSchema`, after the `winner:` line:
```ts
  penaltyHome: goalSchema.nullable().optional(),
  penaltyAway: goalSchema.nullable().optional(),
```

- [ ] **Step 3: Add to the round-trip generator**

In `packages/shared/test/schemas.pbt.test.ts`, in `arbMatch` (the `fc.record({...})`), after the `winner:` line:
```ts
  penaltyHome: fc.option(arbGoal, { nil: null }),
  penaltyAway: fc.option(arbGoal, { nil: null }),
```

- [ ] **Step 4: Build + test**

Run: `npm run build --workspace @wc2026/shared && npm test --workspace @wc2026/shared`
Expected: PASS (round-trip exercises the new fields).

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/types.ts packages/shared/src/schemas.ts packages/shared/test/schemas.pbt.test.ts
git commit -m "feat(shared): add penalty shootout score to Match"
```

---

### Task 2: Ingest + persist the penalty score (API)

**Files:**
- Modify: `api/src/integration/footballApiClient.ts` (`mapToDomain`)
- Modify: `api/src/repos/mappers.ts` (`matchFromItem`)
- Test: `api/test/integration/footballApiClient.test.ts`, `api/test/repos/mappers.pbt.test.ts`

**Interfaces:**
- Consumes: `Match.penaltyHome/penaltyAway` (Task 1); `score.penalties` (already on `ProviderMatch['score']`).
- Produces: ingested matches carry `penaltyHome/penaltyAway`; they round-trip through repos.

- [ ] **Step 1: Write the failing ingest test**

In `api/test/integration/footballApiClient.test.ts`, add assertions to the existing shootout test (the one with `id: 51`, NED v MAR) and a null check:
```ts
it('captures the shootout score (penaltyHome/penaltyAway)', () => {
  const pm: ProviderMatch = {
    id: 54, stage: 'LAST_32', utcDate: '2026-07-01T18:00:00Z', status: 'FINISHED',
    homeTeam: { name: 'Netherlands' }, awayTeam: { name: 'Morocco' },
    score: { winner: 'AWAY_TEAM', duration: 'PENALTY_SHOOTOUT',
      fullTime: { home: 3, away: 4 }, regularTime: { home: 1, away: 1 }, extraTime: { home: 0, away: 0 }, penalties: { home: 2, away: 3 } },
  };
  const m = mapToDomain(pm);
  expect(m.penaltyHome).toBe(2);
  expect(m.penaltyAway).toBe(3);
});
it('leaves penalties null for a normal match', () => {
  const pm: ProviderMatch = { id: 55, stage: 'GROUP_STAGE', utcDate: '2026-06-15T18:00:00Z', status: 'FINISHED',
    homeTeam: { name: 'Brazil' }, awayTeam: { name: 'Chile' }, score: { fullTime: { home: 2, away: 0 } } };
  const m = mapToDomain(pm);
  expect(m.penaltyHome).toBeNull();
  expect(m.penaltyAway).toBeNull();
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test --workspace @wc2026/api -- footballApiClient`
Expected: FAIL — `penaltyHome` is `undefined`.

- [ ] **Step 3: Implement in mapToDomain**

In `api/src/integration/footballApiClient.ts`, in the object returned by `mapToDomain`, after the `winner:` line:
```ts
    penaltyHome: pm.score?.duration === 'PENALTY_SHOOTOUT' ? (pm.score.penalties?.home ?? null) : null,
    penaltyAway: pm.score?.duration === 'PENALTY_SHOOTOUT' ? (pm.score.penalties?.away ?? null) : null,
```

- [ ] **Step 4: Implement repo read-back**

In `api/src/repos/mappers.ts`, `matchFromItem`, after the `winner:` line:
```ts
    penaltyHome: (item.penaltyHome ?? null) as number | null,
    penaltyAway: (item.penaltyAway ?? null) as number | null,
```
(`matchToItem` spreads `...m`, so it already persists them.)

- [ ] **Step 5: Fix the repo round-trip generator**

In `api/test/repos/mappers.pbt.test.ts`, in `arbMatch`, after the `winner:` line, add:
```ts
  penaltyHome: fc.option(fc.integer({ min: 0, max: 20 }), { nil: null }),
  penaltyAway: fc.option(fc.integer({ min: 0, max: 20 }), { nil: null }),
```
(Without this the match round-trip fails: `matchFromItem` now returns `penaltyHome: null` that the generated input lacks.)

- [ ] **Step 6: Run to verify pass**

Run: `npm test --workspace @wc2026/api`
Expected: PASS (full suite — footballApiClient + mappers round-trip green).

- [ ] **Step 7: Commit**

```bash
git add api/src/integration/footballApiClient.ts api/src/repos/mappers.ts api/test/integration/footballApiClient.test.ts api/test/repos/mappers.pbt.test.ts
git commit -m "feat(api): ingest + persist penalty shootout score"
```

---

### Task 3: `pensLabel` shared formatter (web)

**Files:**
- Modify: `web/src/lib/format.ts`
- Test: `web/test/format.test.ts`

**Interfaces:**
- Produces: `pensLabel(m): string | null` where `m: { penaltyHome?: number | null; penaltyAway?: number | null; winner?: Match['winner']; homeCode: string | null; awayCode: string | null }`.

- [ ] **Step 1: Write the failing test**

In `web/test/format.test.ts`, add `pensLabel` to the import from `../src/lib/format`, then:
```ts
describe('pensLabel', () => {
  it('formats the shootout score with the winning team code', () => {
    expect(pensLabel({ penaltyHome: 3, penaltyAway: 4, winner: 'AWAY', homeCode: 'NED', awayCode: 'MAR' })).toBe('pens 3–4 MAR');
    expect(pensLabel({ penaltyHome: 5, penaltyAway: 4, winner: 'HOME', homeCode: 'GER', awayCode: 'PAR' })).toBe('pens 5–4 GER');
  });
  it('null when there is no shootout', () => {
    expect(pensLabel({ penaltyHome: null, penaltyAway: null, winner: 'HOME', homeCode: 'NED', awayCode: 'MAR' })).toBeNull();
  });
  it('falls back to Home/Away when a code is missing', () => {
    expect(pensLabel({ penaltyHome: 3, penaltyAway: 4, winner: 'AWAY', homeCode: 'NED', awayCode: null })).toBe('pens 3–4 Away');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test --workspace @wc2026/web -- format`
Expected: FAIL — `pensLabel is not a function`.

- [ ] **Step 3: Implement**

In `web/src/lib/format.ts`, append:
```ts
/** Terse shootout result line, e.g. "pens 3–4 MAR" — null unless the match went to pens. */
export function pensLabel(m: {
  penaltyHome?: number | null;
  penaltyAway?: number | null;
  winner?: Match['winner'];
  homeCode: string | null;
  awayCode: string | null;
}): string | null {
  if (m.penaltyHome == null || m.penaltyAway == null) return null;
  const code = m.winner === 'HOME' ? (m.homeCode ?? 'Home') : (m.awayCode ?? 'Away');
  return `pens ${m.penaltyHome}–${m.penaltyAway} ${code}`;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm run build --workspace @wc2026/shared && npm test --workspace @wc2026/web -- format`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/format.ts web/test/format.test.ts
git commit -m "feat(web): pensLabel formatter for shootout results"
```

---

### Task 4: Show the pens line in the three display sites (web)

**Files:**
- Modify: `web/src/components/MatchCard.tsx` (FT line + details modal header)
- Modify: `web/src/pages/MatchPredictionsPage.tsx` (head)
- Modify: `web/src/styles.css` (one small muted class)

**Interfaces:**
- Consumes: `pensLabel` (Task 3); `match.penaltyHome/penaltyAway` (Tasks 1–2).

- [ ] **Step 1: Import pensLabel in MatchCard**

In `web/src/components/MatchCard.tsx`, add `pensLabel` to the existing import from `../lib/format`.

- [ ] **Step 2: Append to the FT line**

In `MatchCard.tsx`, the `state === 'Played'` block:
```tsx
{state === 'Played' && (
  <div className="mc-result" data-testid={`ft-${match.id}`}>
    FT <strong>{match.homeScore}–{match.awayScore}</strong>
    {pensLabel(match) && <span className="mc-pens"> · {pensLabel(match)}</span>}
  </div>
)}
```

- [ ] **Step 3: Add to the match-details modal header**

In `MatchCard.tsx`, immediately after the `</div>` that closes `modal-head` (before `<MatchStatsPanel ... />`):
```tsx
{pensLabel(match) && <div className="mm-pens muted fine" data-testid={`mm-pens-${match.id}`}>{pensLabel(match)}</div>}
```

- [ ] **Step 4: Add to the who-picked-what header**

In `web/src/pages/MatchPredictionsPage.tsx`, import `pensLabel` from `../lib/format`, and right after the `mp-head` block:
```tsx
{match && pensLabel(match) && <div className="mp-pens muted fine" style={{ textAlign: 'center' }}>{pensLabel(match)}</div>}
```

- [ ] **Step 5: Add minimal styling**

In `web/src/styles.css`, near `.mc-result`, add:
```css
.mc-pens { color: var(--muted); font-weight: 600; font-size: var(--text-sm); }
.mm-pens { text-align: center; margin-top: 4px; }
```

- [ ] **Step 6: Verify**

Run: `npm run build --workspace @wc2026/shared && npm run typecheck --workspace @wc2026/web && npm test --workspace @wc2026/web && npm run build --workspace @wc2026/web`
Expected: typecheck PASS, tests PASS, build PASS.

- [ ] **Step 7: Manual check**

Run the app; for a finished pens match (knockout, e.g. NED v MAR), the card shows `FT 1–1 · pens 3–4 MAR`, the details modal and the who-picked page show the same line, and a normal match shows no pens line. (Web has no component-test harness — typecheck/build + this manual pass is the verification.)

- [ ] **Step 8: Commit**

```bash
git add web/src/components/MatchCard.tsx web/src/pages/MatchPredictionsPage.tsx web/src/styles.css
git commit -m "feat(web): show penalty shootout result on card, modal, who-picked"
```

---

## Final verification

- [ ] `npm test` (root — shared + api + web green)
- [ ] `npm run typecheck --workspace @wc2026/web`
- [ ] `npm run build --workspace @wc2026/web`
- [ ] Manual: pens match shows `FT 1–1 · pens 3–4 MAR` in all three sites; normal match unaffected.

## Notes

- The matches endpoint returns `Match` objects directly, so the new fields reach the web with no DTO change; confirm in the manual check that `/api/matches` includes `penaltyHome/penaltyAway` for a pens match.
- After deploy, the every-minute sync re-ingests finished pens matches and populates the new fields automatically.
