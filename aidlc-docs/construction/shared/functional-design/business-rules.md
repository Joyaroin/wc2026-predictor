# Business Rules — Unit `shared`

## BR-1 Scoring (per match)
Given a prediction `P{home,away}` and the actual full-time score `A{home,away}`:
- **BR-1.1** If `P.home == A.home && P.away == A.away` → **5** (exact).
- **BR-1.2** Else if `outcome(P) == outcome(A)` and `(P.home - P.away) == (A.home - A.away)` → **3** (correct goal difference; for draws this can only occur via BR-1.1, so applies to non-draws).
- **BR-1.3** Else if `outcome(P) == outcome(A)` → **2** (correct result only).
- **BR-1.4** Else → **0** (wrong outcome).
- **BR-1.5** `outcome(s) = HOME if s.home>s.away; AWAY if s.home<s.away; else DRAW`.
- **BR-1.6** If there is no prediction for a finished match, score **0** (handled at aggregation; engine only scores existing predictions).
- **BR-1.7** Points are computed only when `A.home` and `A.away` are both present (match FINISHED). Otherwise points remain 0.
- **BR-1.8** (derived property) A predicted **draw** that matches the actual draw outcome always has the same goal difference (0), so a non-exact correct draw always scores **3** — it can never score 2. The 2-point "correct result only" tier is therefore reachable only for non-draw outcomes (home/away wins with the wrong margin). Verified by example test.

## BR-2 Knockout predictions
- **BR-2.1** Knockout predictions are 90-minute scorelines; draws are allowed and scored exactly like group games (no extra-time/penalty input). The scoring engine treats all matches identically.

## BR-3 Tie-break ordering (leaderboard)
Order StandingAgg descending by, in sequence:
- **BR-3.1** `points` (higher first)
- **BR-3.2** then `exacts` (higher first)
- **BR-3.3** then `correctResults` (higher first)
- **BR-3.4** then `name` ascending, case-insensitive (final deterministic fallback — decision Q1=C).
- The comparator is a total order (deterministic for all inputs).

## BR-4 Validation bounds (SECURITY-05)
- **BR-4.1** `home`/`away` goals: integers in `[0, 30]` inclusive. Reject non-integers, negatives, or > 30.
- **BR-4.2** Player `name`: 1–30 chars after trim; reject empty/whitespace-only; strip control characters.
- **BR-4.3** Group `name`: 1–40 chars after trim.
- **BR-4.4** `inviteCode`: matches `^[A-Z2-9]{8}$` (base32 excluding ambiguous 0/O/1/I); case-insensitive on input, normalized to upper.
- **BR-4.5** All bounds enforced via zod schemas exported from `shared` and reused by `backend` (single source of truth).

## BR-5 Determinism / purity
- **BR-5.1** Scoring and comparator functions are pure: same inputs → same output, no I/O, no clock, no randomness.
- **BR-5.2** Lock decisions are NOT in `shared` (they need the server clock) — they live in `backend`. `shared` only provides pure data + scoring.
