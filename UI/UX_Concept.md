# Match Predictor — UX/UI Implementation Spec

A score-prediction interface where users predict the final scoreline of every tournament fixture, optionally accept crowd-suggested scores, and save their picks. Built as a dense, scannable grid of self-contained match cards. Mobile-first, broadcast-style visual language.

---

## 1. Design Tokens (UI foundation)

Define these as the single source of truth (CSS variables / theme object). Everything below references them.

### Color
| Token | Value (approx) | Usage |
|---|---|---|
| `--c-bg-hero` | `#2B5BE8` royal blue | Hero band, page background behind cards |
| `--c-surface` | `#FFFFFF` | Card body (prediction zone) |
| `--c-structure` | `#0E2148` deep navy | Card header/footer, filled inputs, outlined chips |
| `--c-structure-2` | `#16306B` | Secondary navy panels (footer strip) |
| `--c-input-empty` | `#7A86A8` muted grey-blue | Empty score box fill |
| `--c-accent` | `#F47A20` orange | Primary CTA (Auto Fill), status pills, lightning icon — **attention only** |
| `--c-accent-soft` | `#F6C6A0` peach | Secondary CTA (Save) |
| `--c-text-onDark` | `#FFFFFF` | Text on navy/blue |
| `--c-text-onLight` | `#0E2148` | Text on white |

**Accent rule (enforce in review):** `--c-accent` is reserved for live/actionable elements only. It must not be used for decoration, borders, or body text. This is what trains the eye to read orange as "do this / this is live."

### Typography
- Display/headers: condensed, uppercase, squared sport face (e.g. a condensed grotesque). Used for `ROUND N`, brand lockup, CTA labels.
- Body/data: clean sans for venue, dates, percentages.
- Establish a type scale: `--fs-card-title`, `--fs-meta`, `--fs-score`, `--fs-chip`. Keep chip/percentage text legible — do not go below 12px effective size.

### Spacing & shape
- Spacing scale: 4 / 8 / 12 / 16 / 24.
- `--radius-card: 12px`, `--radius-chip: 999px` (pill), `--radius-input: 8px`.
- Consistent internal card padding (16px) so every card has identical rhythm.

---

## 2. Layout

- **Page background:** royal blue hero band at top, transitioning to the card grid.
- **Card grid:** responsive.
  - Desktop: 3 columns.
  - Tablet: 2 columns.
  - Mobile: 1 column.
  - Equal gutters, cards equal height within a row.
- **Persistent action bar:** floating, fixed to viewport bottom, centered, always visible regardless of scroll position. Sits above the grid (z-indexed) with a slight shadow so it reads as floating.
- **Chrome:** assume the component mounts inside an existing site shell (global nav + sub-nav tabs already present). Build the Match Predictor as a self-contained module that does not re-implement global nav.

---

## 3. Components

### 3.1 MatchCard (core repeating unit)
Self-contained. Identical internal structure for every fixture so the layout is learn-once. Top-to-bottom:

1. **Header strip** (`--c-structure`): `ROUND N` (left, uppercase) + status pill (right).
2. **Meta row** (white surface): date + time, then venue name, centered.
3. **Prediction zone:** `[FlagLeft] [ScoreInput] [ScoreInput] [FlagRight]` with the two team codes (e.g. `MEX` / `RSA`) below each flag.
4. **Popular Picks block:** label + three pick chips.
5. **Footer strip** (`--c-structure-2`): lightning icon (left) + "Match Centre" link (right).

**Props (contract):**
```
MatchCard {
  round: string
  status: 'scheduled' | 'live' | 'final'
  kickoff: ISODateTime
  venue: string
  home: { code: string, flag: ImgRef }
  away: { code: string, flag: ImgRef }
  prediction: { home: number | null, away: number | null }
  popularPicks: Array<{ home: number, away: number, pct: number }>  // length 3
  isActive: boolean   // currently being edited
}
```

### 3.2 StatusPill
- Rounded pill, `--c-accent` background, dark text.
- States: `Scheduled` (orange), `Live` (orange + subtle pulse), `Final` (muted/neutral fill, no accent — a finished match is no longer actionable).

### 3.3 ScoreInput
- Two boxes sit **between** the flags so the spatial mapping is self-evident (left box = left/home team). No text labels needed.
- **Empty state:** `--c-input-empty` fill, shows a dash placeholder.
- **Filled state:** solid `--c-structure` fill, white numeral.
- This filled/empty contrast is the user's progress indicator across the whole grid — keep it high-contrast.
- Input method: numeric only, 0–9 (cap at a sane max, e.g. 19). Tap/click to focus; on mobile show numeric keypad.

### 3.4 PopularPicks
- Label "Popular Picks" + three chips, e.g. `2 - 0 (38%)`.
- Each chip is tappable and writes that scoreline into `ScoreInput` (a shortcut — lowers effort, adds social proof).
- **Selected chip:** solid `--c-structure` fill, white text. Unselected: outlined, transparent fill.
- Selecting a chip and typing a score are the same underlying action — keep them in sync (typing a score that matches a chip highlights that chip; editing away from it de-highlights).

### 3.5 ActionBar (floating)
Three actions, hierarchy expressed through fill weight:
- **Auto Fill** — solid `--c-accent`. The promoted "do it for me" path; fills every empty card (with popular pick or random valid score — define which).
- **Save** — `--c-accent-soft` peach. Persists current predictions.
- **Reset** — neutral outline only. Destructive-ish, so visually de-emphasized to avoid accidental taps. Require a confirm step before wiping filled predictions.

---

## 4. UX Flows & States

### Filling a prediction
1. User taps a score box (or a Popular Pick chip).
2. Card enters `isActive` — must be visually distinct from inactive cards (raise contrast / border / subtle lift). **Current spec gap: make active state clearly stronger than the resting card.**
3. Score fills → input flips to filled style → that card now reads as "done" on a glance-scan.

### Auto Fill
- Fills all *empty* cards only (never overwrite existing user picks without confirm).
- Animate fills in sequence or batch — give feedback that something happened.

### Save
- Persist predictions; show lightweight success confirmation (toast/inline), not a full page reload.
- Should be resumable: user returns later and sees saved state intact (long-tournament use case — repeat visits across many matchdays).

### Empty / loading / error
- Loading: skeleton cards in the grid (preserve layout, no jump).
- Save failure: non-blocking error + retry, never lose entered scores.
- Locked match (kickoff passed): inputs disabled, status → `Live`/`Final`, picks read-only.

---

## 5. Accessibility (do not skip)
- Score boxes are form inputs: real `<input>` semantics, labelled (e.g. "Mexico score, Round 1") even though the visual relies on position.
- Color is never the only signal: filled vs empty also differs by content (numeral vs dash); status pills carry text, not just color.
- Floating action bar must be keyboard-reachable and not trap focus.
- Target sizes ≥ 44px for chips, inputs, and CTAs (dense grid makes this easy to violate — watch it).
- Meet WCAG AA contrast, especially small percentage chip text on light backgrounds.

---

## 6. Acceptance Criteria
- [ ] Every match card has identical internal section order and spacing.
- [ ] Orange (`--c-accent`) appears only on actionable/live elements; audit confirms no decorative use.
- [ ] Empty vs filled score boxes are distinguishable at a glance across a full grid.
- [ ] Tapping a Popular Pick chip writes that score and highlights the chip; typing a matching score highlights the chip too.
- [ ] Action bar stays fixed and fully visible at any scroll position, on all breakpoints.
- [ ] Auto Fill only fills empty cards; Save persists and survives reload; Reset confirms before clearing.
- [ ] Active (currently-editing) card is clearly stronger than resting cards.
- [ ] Grid reflows 3 → 2 → 1 columns without layout breakage; cards in a row are equal height.
- [ ] All interactive elements keyboard-operable and screen-reader labelled.