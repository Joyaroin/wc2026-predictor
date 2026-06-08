# Business Logic Model — Unit `shared`

## Scoring algorithm (pseudocode)
```
function outcomeOf(s):
    if s.home > s.away: return HOME
    if s.home < s.away: return AWAY
    return DRAW

function computePoints(P, A):           # A must be a complete score
    if P.home == A.home and P.away == A.away: return 5
    if outcomeOf(P) != outcomeOf(A):          return 0
    if (P.home - P.away) == (A.home - A.away): return 3   # same margin & same outcome
    return 2                                   # correct outcome only
```

## Tie-break comparator (pseudocode)
```
function compareStandings(a, b):        # returns <0 if a ranks before b
    if a.points     != b.points:     return b.points - a.points
    if a.exacts     != b.exacts:     return b.exacts - a.exacts
    if a.correctResults != b.correctResults: return b.correctResults - a.correctResults
    return caseInsensitiveCompare(a.name, b.name)     # BR-3.4
```

## PBT-01 Testable Properties (Property-Based Testing — Partial mode anchor)

> Enforced PBT rules in Partial mode: PBT-02, PBT-03, PBT-07, PBT-08, PBT-09. Framework: **fast-check** (PBT-09).

### Scoring — Invariants (PBT-03)
| ID | Category | Property |
|---|---|---|
| SP-1 | Invariant (range) | `computePoints(P,A)` ∈ {0,2,3,5} for all valid P,A |
| SP-2 | Invariant | `computePoints(A,A) == 5` for all A (identical prediction = exact) |
| SP-3 | Invariant | if `outcomeOf(P) != outcomeOf(A)` then `computePoints == 0` |
| SP-4 | Invariant | if `outcomeOf(P) == outcomeOf(A)` then `computePoints >= 2` (never 0) |
| SP-5 | Invariant | `5` is returned **iff** P == A (exact ⇔ 5) |
| SP-6 | Invariant | `3` ⇒ `P != A` AND `(P.home-P.away)==(A.home-A.away)` AND outcomes equal |
| SP-7 | Symmetry | swapping home/away in BOTH P and A leaves the score unchanged: `computePoints(swap(P),swap(A)) == computePoints(P,A)` |

### Tie-break comparator — Invariants (PBT-03)
| ID | Category | Property |
|---|---|---|
| TP-1 | Invariant (total order) | `compare(a,b)` and `compare(b,a)` have opposite signs (or both 0 when fully equal incl. name) |
| TP-2 | Invariant (transitivity) | if `compare(a,b)<=0` and `compare(b,c)<=0` then `compare(a,c)<=0` |
| TP-3 | Invariant (priority) | higher points always ranks first regardless of exacts/correctResults/name |

### Serialization round-trip (PBT-02)
| ID | Category | Property |
|---|---|---|
| RT-1 | Round-trip | `parse(schema, serialize(x)) == x` for generated `Prediction`, `Match`, `Score` (zod schema encode/decode identity) |

### Generators (PBT-07)
- `arbScore`: `{home,away}` with goals drawn from `0..30` (include boundaries 0 and 30, and small values heavily — realistic football).
- `arbPrediction`, `arbMatch`, `arbStandingAgg`: domain generators respecting bounds (names non-empty ≤30, points ≥0, exacts ≤ correctResults conceptually).
- No raw unbounded primitives for domain-typed params.

### Shrinking & reproducibility (PBT-08)
- fast-check default shrinking enabled; on failure log the seed and minimal counterexample; CI runs with logged seed.

### Complementary example-based tests (PBT-10, advisory)
- Pin each tier explicitly: e.g. `(2,1) vs (2,1) = 5`, `(3,1) vs (2,0) = 3`, `(2,0) vs (1,0) = 2`, `(0,1) vs (1,0) = 0`, draw exact `(1,1) vs (1,1) = 5`, draw outcome `(0,0) vs (2,2) = 2`.

## Notes
- The scoring engine has **no infrastructure concerns** (pure). Persistence of `points` and the server-clock lock decision live in `backend`.
