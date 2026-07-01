# Knockout Bracket View

**Date:** 2026-06-30
**Status:** Approved design — pending spec review

## Context

The app shows knockout matches only in the flat Fixtures list; there's no way to see the
tournament's shape — who plays whom on the road to the final. This adds a dedicated **Bracket**
tab showing the knockout rounds (R32 · R16 · QF · SF · Final + 3rd place), with each player's
predicted advancers highlighted. Standings moves into the ⋮ menu to free the primary-nav slot.

Derived entirely from existing data (knockout matches + the player's scoreline predictions) —
no schema or model change.

## Requirements

1. **Navigation:** move **Standings** into the ⋮ dropdown; add **Bracket** as a primary
   destination — bottom-nav tab (mobile) and top-bar link (desktop). `/bracket` renders the new
   page (remove the current redirect to `/awards`).
2. **Bracket page:** show all knockout matches grouped by round.
   - **Mobile:** a segmented round selector (R32/R16/QF/SF/F) + a vertical list of match cards
     for the selected round; default to the current/live round.
   - **Desktop:** a classic connected bracket — rounds as columns with connector lines feeding
     the final; the third-place match shown near the final.
3. Placeholder/undecided ties render as **TBD**; decided ties show the score (with `pens x–y`
   when applicable) and the advancing side emphasised.
4. **My advancers overlay** (display-only): mark the team the player predicted to advance in each
   tie; once decided, show ✓/✗ (did their pick advance).

## Data & derivation

No new persisted data.

- **Rounds:** filter `matches` where `stage !== 'GROUP_STAGE'`; group by stage in order
  `LAST_32, LAST_16, QUARTER_FINALS, SEMI_FINALS, THIRD_PLACE, FINAL`.
- **Actual advancer:** `match.winner` (`HOME`/`AWAY`), already correct incl. shootouts.
- **Player's predicted advancer** (pure helper, shared or web-local):
  - Given the player's `Prediction` for a match: if `home > away` → `HOME`; if `away > home`
    → `AWAY`; if a draw (`home === away`) → `prediction.penWinner ?? null`.
  - Returns `HOME | AWAY | null` (null when no prediction, or a draw with no pen winner).
- **Hit/miss:** once `match.winner` is set, the pick is a hit when `predictedAdvancer === winner`.

## Desktop bracket tree edges

The connected desktop view needs to know which tie feeds which (R32→R16→…). football-data.org
does not reliably encode these edges. Use a **static WC2026 bracket map** keyed by the
deterministic fixture slots (round + position) → parent slot. Kept in one small module
(`web/src/lib/bracketMap.ts`) with a clear comment. The **mobile round-by-round view does not use
this** and works regardless; if the map needs tuning, only the desktop connectors are affected.

## Components / files

- `web/src/App.tsx` — replace the `/bracket`→`/awards` redirect with `<BracketPage/>`.
- `web/src/components/Nav.tsx` — remove Standings from top links, add Bracket; add Standings to the
  ⋮ dropdown.
- `web/src/components/BottomNav.tsx` — replace the Standings tab with a Bracket tab.
- `web/src/pages/BracketPage.tsx` — the page: round grouping, mobile chips+list, desktop columns.
- `web/src/components/BracketMatch.tsx` — one tie (two team rows, score/TBD, advancer emphasis,
  my-pick ✓/✗). Small, reused by both layouts.
- `web/src/lib/bracket.ts` — pure helpers: `predictedAdvancer(pred)`, round grouping/order.
- `web/src/lib/bracketMap.ts` — static desktop edge map.
- `web/src/styles.css` — bracket layout + connector styles.

## Testing

- `web/test/` (vitest): `predictedAdvancer` — home win → HOME, away win → AWAY, draw+penWinner →
  that side, draw no pen → null, no prediction → null. Round grouping/order helper.
- Web has no component-test harness, so the page/layout is verified by typecheck + build + a
  manual pass on dev (mobile round switch; desktop bracket renders; TBD ties; my-advancer ✓/✗).

## Out of scope (v1)

- Editing advancement picks from the bracket (picks stay derived from scorelines).
- Group-stage standings-style content in the bracket.
- Animated bracket transitions.
