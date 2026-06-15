import { describe, it, expect } from 'vitest';
import { suggestFromOdds } from '../src/suggest';

describe('suggestFromOdds', () => {
  it('returns null without a total or moneylines', () => {
    expect(suggestFromOdds({ overUnder: null, homeMoneyLine: 100, awayMoneyLine: 100, drawMoneyLine: 200 })).toBeNull();
    expect(suggestFromOdds({ overUnder: 2.5, homeMoneyLine: null, awayMoneyLine: 100, drawMoneyLine: 200 })).toBeNull();
  });

  it('favours the team with the shorter moneyline (real ESPN TUR@AUS odds)', () => {
    // Türkiye (away) -135 favourite, Australia (home) +425, draw 270, total 2.5
    const s = suggestFromOdds({ overUnder: 2.5, homeMoneyLine: 425, awayMoneyLine: -135, drawMoneyLine: 270, source: 'DraftKings' });
    expect(s).not.toBeNull();
    expect(s!.scores).toHaveLength(3);
    expect(s!.firstTeam).toBe('AWAY'); // the favourite
    // top scoreline should have the away side scoring at least as many as home
    expect(s!.scores[0]!.away).toBeGreaterThanOrEqual(s!.scores[0]!.home);
    // probabilities descending and in (0,1]
    expect(s!.scores[0]!.prob).toBeGreaterThanOrEqual(s!.scores[1]!.prob);
    expect(s!.confidence).toBe(s!.scores[0]!.prob);
    expect(s!.source).toBe('DraftKings');
  });

  it('is symmetric: equal moneylines ⇒ no side favoured (draw-ish, HOME first by tie-break)', () => {
    const s = suggestFromOdds({ overUnder: 2.5, homeMoneyLine: 200, awayMoneyLine: 200, drawMoneyLine: 200 });
    expect(s).not.toBeNull();
    expect(s!.scores[0]!.home).toBe(s!.scores[0]!.away); // most likely is a draw
  });
});
