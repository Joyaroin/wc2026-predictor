// Property-based tests for the scoring engine (PBT-03 invariants, PBT-07 generators, PBT-08 shrink/seed).
// fast-check logs the seed and shrunk counterexample automatically on failure.
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { computePoints, outcomeOf, compareStandings } from '../src/scoring';
import type { Score, StandingAgg } from '../src/types';

// PBT-07 — domain generators (bounded, realistic goal counts incl. boundaries 0 and 30).
const arbGoal = fc.integer({ min: 0, max: 30 });
const arbScore: fc.Arbitrary<Score> = fc.record({ home: arbGoal, away: arbGoal });

const arbStanding: fc.Arbitrary<StandingAgg> = fc.record({
  playerId: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 30 }),
  points: fc.nat({ max: 500 }),
  exacts: fc.nat({ max: 104 }),
  correctResults: fc.nat({ max: 104 }),
});

const swap = (s: Score): Score => ({ home: s.away, away: s.home });

describe('computePoints — invariants (SP-1..SP-7)', () => {
  it('SP-1: result is always one of {0,2,3,5}', () => {
    fc.assert(
      fc.property(arbScore, arbScore, (p, a) => {
        expect([0, 2, 3, 5]).toContain(computePoints(p, a));
      }),
    );
  });

  it('SP-2/SP-5: exact prediction ⇔ 5', () => {
    fc.assert(
      fc.property(arbScore, arbScore, (p, a) => {
        const exact = p.home === a.home && p.away === a.away;
        expect(computePoints(p, a) === 5).toBe(exact);
      }),
    );
  });

  it('SP-3: wrong outcome ⇒ 0', () => {
    fc.assert(
      fc.property(arbScore, arbScore, (p, a) => {
        if (outcomeOf(p) !== outcomeOf(a)) {
          expect(computePoints(p, a)).toBe(0);
        }
      }),
    );
  });

  it('SP-4: correct outcome ⇒ never 0', () => {
    fc.assert(
      fc.property(arbScore, arbScore, (p, a) => {
        if (outcomeOf(p) === outcomeOf(a)) {
          expect(computePoints(p, a)).toBeGreaterThanOrEqual(2);
        }
      }),
    );
  });

  it('SP-6: 3 ⇒ same outcome and same goal difference (not exact)', () => {
    fc.assert(
      fc.property(arbScore, arbScore, (p, a) => {
        if (computePoints(p, a) === 3) {
          expect(outcomeOf(p)).toBe(outcomeOf(a));
          expect(p.home - p.away).toBe(a.home - a.away);
          expect(p.home === a.home && p.away === a.away).toBe(false);
        }
      }),
    );
  });

  it('SP-7: home/away symmetry (swap both prediction and actual)', () => {
    fc.assert(
      fc.property(arbScore, arbScore, (p, a) => {
        expect(computePoints(swap(p), swap(a))).toBe(computePoints(p, a));
      }),
    );
  });
});

describe('compareStandings — total order (TP-1..TP-3)', () => {
  it('TP-1: antisymmetry of sign', () => {
    fc.assert(
      fc.property(arbStanding, arbStanding, (a, b) => {
        expect(Math.sign(compareStandings(a, b))).toBe(-Math.sign(compareStandings(b, a)));
      }),
    );
  });

  it('TP-2: transitivity', () => {
    fc.assert(
      fc.property(arbStanding, arbStanding, arbStanding, (a, b, c) => {
        if (compareStandings(a, b) <= 0 && compareStandings(b, c) <= 0) {
          expect(compareStandings(a, c)).toBeLessThanOrEqual(0);
        }
      }),
    );
  });

  it('TP-3: higher points always ranks first', () => {
    fc.assert(
      fc.property(arbStanding, arbStanding, (a, b) => {
        if (a.points > b.points) {
          expect(compareStandings(a, b)).toBeLessThan(0);
        }
      }),
    );
  });
});
