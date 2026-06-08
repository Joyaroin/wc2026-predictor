// Example-based tests pinning the four scoring tiers (PBT-10 complementary tests).
import { describe, it, expect } from 'vitest';
import { computePoints, outcomeOf, compareStandings } from '../src/scoring';
import type { StandingAgg } from '../src/types';

describe('computePoints — scoring tiers', () => {
  it('exact score → 5 (home win)', () => {
    expect(computePoints({ home: 2, away: 1 }, { home: 2, away: 1 })).toBe(5);
  });
  it('exact score → 5 (draw)', () => {
    expect(computePoints({ home: 1, away: 1 }, { home: 1, away: 1 })).toBe(5);
  });
  it('correct goal difference (not exact) → 3', () => {
    // both +2 home margin, different exact score
    expect(computePoints({ home: 3, away: 1 }, { home: 2, away: 0 })).toBe(3);
  });
  it('correct result only → 2', () => {
    // both home wins, different margin
    expect(computePoints({ home: 2, away: 0 }, { home: 1, away: 0 })).toBe(2);
  });
  it('non-exact draw → 3 (goal difference is always 0 for draws, so it always matches)', () => {
    // A correct-but-inexact draw can never score only 2: matching outcome (DRAW)
    // implies matching goal difference (0), which is the 3-point tier.
    expect(computePoints({ home: 0, away: 0 }, { home: 2, away: 2 })).toBe(3);
  });
  it('wrong outcome → 0', () => {
    expect(computePoints({ home: 0, away: 1 }, { home: 1, away: 0 })).toBe(0);
  });
});

describe('outcomeOf', () => {
  it('classifies home/away/draw', () => {
    expect(outcomeOf({ home: 2, away: 1 })).toBe('HOME');
    expect(outcomeOf({ home: 0, away: 3 })).toBe('AWAY');
    expect(outcomeOf({ home: 1, away: 1 })).toBe('DRAW');
  });
});

describe('compareStandings — tie-break order', () => {
  const base: StandingAgg = { playerId: 'p', name: 'Zed', points: 10, exacts: 1, correctResults: 3 };

  it('orders by points first', () => {
    const a = { ...base, points: 12 };
    const b = { ...base, points: 8 };
    expect(compareStandings(a, b)).toBeLessThan(0);
  });
  it('breaks equal points by exacts', () => {
    const a = { ...base, exacts: 3 };
    const b = { ...base, exacts: 1 };
    expect(compareStandings(a, b)).toBeLessThan(0);
  });
  it('breaks equal points+exacts by correctResults', () => {
    const a = { ...base, correctResults: 5 };
    const b = { ...base, correctResults: 2 };
    expect(compareStandings(a, b)).toBeLessThan(0);
  });
  it('final fallback is alphabetical by name (case-insensitive)', () => {
    const a: StandingAgg = { ...base, name: 'amir' };
    const b: StandingAgg = { ...base, name: 'Bella' };
    expect(compareStandings(a, b)).toBeLessThan(0);
  });
});
