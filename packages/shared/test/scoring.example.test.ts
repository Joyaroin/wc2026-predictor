// Example-based tests for the additive scoreline scoring.
import { describe, it, expect } from 'vitest';
import { computePoints, scoreBreakdown, outcomeOf, compareStandings, penaltyWinnerPoints, PEN_WINNER_POINTS } from '../src/scoring';
import type { StandingAgg } from '../src/types';

describe('computePoints — additive scoreline', () => {
  it('perfect exact score → 12 (outcome 2 + diff 3 + exact 3 + team1 2 + team2 2)', () => {
    expect(computePoints({ home: 2, away: 1 }, { home: 2, away: 1 })).toBe(12);
    expect(computePoints({ home: 1, away: 1 }, { home: 1, away: 1 })).toBe(12);
  });
  it('correct outcome + goal difference (not exact) → 5', () => {
    expect(computePoints({ home: 3, away: 1 }, { home: 2, away: 0 })).toBe(5); // both home +2
  });
  it('correct outcome only, no team exact → 2', () => {
    expect(computePoints({ home: 3, away: 1 }, { home: 1, away: 0 })).toBe(2); // home win, nothing else
  });
  it('correct outcome + one team exact → 4', () => {
    expect(computePoints({ home: 2, away: 0 }, { home: 2, away: 1 })).toBe(4); // home win (2) + team1 (2)
  });
  it('one team exact but WRONG outcome → 2 (predict 1-1, actual 5-1)', () => {
    expect(computePoints({ home: 1, away: 1 }, { home: 5, away: 1 })).toBe(2); // away team's 1
  });
  it('goal margin counts on the wrong winner → 3 (predict 1-0, actual 0-1)', () => {
    // Wrong outcome, but the 1-goal margin matches → +3.
    expect(computePoints({ home: 1, away: 0 }, { home: 0, away: 1 })).toBe(3);
    expect(scoreBreakdown({ home: 2, away: 1 }, { home: 1, away: 2 })).toMatchObject({ outcome: false, goalDiff: true, points: 3 });
  });
  it('nothing right → 0', () => {
    expect(computePoints({ home: 0, away: 2 }, { home: 1, away: 0 })).toBe(0);
  });
  it('breakdown exposes each component', () => {
    expect(scoreBreakdown({ home: 2, away: 0 }, { home: 2, away: 1 })).toEqual({
      outcome: true, goalDiff: false, exact: false, home: true, away: false, points: 4,
    });
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
    expect(compareStandings({ ...base, points: 12 }, { ...base, points: 8 })).toBeLessThan(0);
  });
  it('breaks equal points by exacts', () => {
    expect(compareStandings({ ...base, exacts: 3 }, { ...base, exacts: 1 })).toBeLessThan(0);
  });
  it('breaks equal points+exacts by correctResults', () => {
    expect(compareStandings({ ...base, correctResults: 5 }, { ...base, correctResults: 2 })).toBeLessThan(0);
  });
  it('final fallback is alphabetical by name (case-insensitive)', () => {
    expect(compareStandings({ ...base, name: 'amir' }, { ...base, name: 'Bella' })).toBeLessThan(0);
  });
});

describe('penaltyWinnerPoints', () => {
  const ko = { stage: 'LAST_16' as const, homeScore: 1, awayScore: 1, winner: 'HOME' as const };
  it('+5 when draw predicted and shootout winner correct (any draw scoreline)', () => {
    expect(penaltyWinnerPoints({ home: 1, away: 1, penWinner: 'HOME' }, ko)).toBe(PEN_WINNER_POINTS);
    expect(penaltyWinnerPoints({ home: 0, away: 0, penWinner: 'HOME' }, ko)).toBe(5);
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
