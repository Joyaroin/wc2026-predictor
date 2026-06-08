# Functional Design Plan — Unit `shared`

**Unit**: `shared` (packages/shared) — domain types, zod schemas, pure scoring engine.
**Stories**: US-3.2, US-4.1, US-4.6, US-5.1, US-5.2, US-5.4 (scoring/validation primitives).
Most behavior is fully specified by the requirements. Two edge cases need confirmation.

---

## Part A: Questions (please answer)

### Question 1 — Tie-break final fallback
Tie-break order is: total points → most exact scores → most correct results. If two players are **still** tied after all three, how should they be ordered on the leaderboard?

A) **Share the same rank** (display equal rank, e.g. joint 2nd), then order alphabetically by name for display only (recommended)
B) Order by earliest join time (whoever joined the group first ranks higher)
C) Strictly alphabetical by display name
X) Other (please describe after [Answer]: tag below)

[Answer]:C

### Question 2 — Score input bounds (validation)
What min/max goals per side should be accepted for a prediction (and from results)?

A) **0 to 30** inclusive, integers only (recommended — generous but bounded; rejects absurd/abuse input per SECURITY-05)
B) 0 to 99 inclusive
C) 0 to 9 inclusive (single digit)
X) Other (please describe after [Answer]: tag below)

[Answer]:A

---

## Part B: Functional Design Artifacts (generated after Part A)

- [x] `construction/shared/functional-design/domain-entities.md` — entities/types (Player, Group, Match, Prediction, Score, enums)
- [x] `construction/shared/functional-design/business-rules.md` — scoring rules (5/3/2/0), tie-break comparator, validation bounds
- [x] `construction/shared/functional-design/business-logic-model.md` — scoring algorithm + **PBT-01 Testable Properties** section
- [x] No frontend-components.md (shared has no UI)

## Answers (recorded): Q1=C (final tie-break: alphabetical by name), Q2=A (scores 0..30 integers). Unambiguous; no follow-ups.
