// Property-based tests for the additive scoring engine.
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { computePoints, scoreBreakdown, outcomeOf, compareStandings, MAX_SCORELINE_POINTS } from '../src/scoring';
import type { Score, StandingAgg } from '../src/types';

const arbGoal = fc.integer({ min: 0, max: 30 });
const arbScore: fc.Arbitrary<Score> = fc.record({ home: arbGoal, away: arbGoal });

const arbStanding: fc.Arbitrary<StandingAgg> = fc.record({
  playerId: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 30 }),
  points: fc.nat({ max: 5000 }),
  exacts: fc.nat({ max: 104 }),
  correctResults: fc.nat({ max: 104 }),
});

const swap = (s: Score): Score => ({ home: s.away, away: s.home });

describe('computePoints — additive invariants', () => {
  it('SP-1: 0 ≤ points ≤ 12', () => {
    fc.assert(
      fc.property(arbScore, arbScore, (p, a) => {
        const pts = computePoints(p, a);
        expect(pts).toBeGreaterThanOrEqual(0);
        expect(pts).toBeLessThanOrEqual(MAX_SCORELINE_POINTS);
      }),
    );
  });

  it('SP-2: exact prediction ⇔ 12', () => {
    fc.assert(
      fc.property(arbScore, arbScore, (p, a) => {
        const exact = p.home === a.home && p.away === a.away;
        expect(computePoints(p, a) === 12).toBe(exact);
      }),
    );
  });

  it('SP-3: wrong outcome ⇒ not exact and ≤ 5 (margin +3 and/or one team +2, never outcome)', () => {
    fc.assert(
      fc.property(arbScore, arbScore, (p, a) => {
        if (outcomeOf(p) !== outcomeOf(a)) {
          const bd = scoreBreakdown(p, a);
          expect(bd.exact).toBe(false);
          expect(bd.outcome).toBe(false);
          expect(bd.points).toBeLessThanOrEqual(5);
        }
      }),
    );
  });

  it('SP-4: correct outcome ⇒ at least 2', () => {
    fc.assert(
      fc.property(arbScore, arbScore, (p, a) => {
        if (outcomeOf(p) === outcomeOf(a)) {
          expect(computePoints(p, a)).toBeGreaterThanOrEqual(2);
        }
      }),
    );
  });

  it('SP-5: correct goal margin (|diff|) ⇒ at least 3 (whether the predicted team won or lost)', () => {
    fc.assert(
      fc.property(arbScore, arbScore, (p, a) => {
        if (Math.abs(p.home - p.away) === Math.abs(a.home - a.away)) {
          expect(computePoints(p, a)).toBeGreaterThanOrEqual(3);
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
