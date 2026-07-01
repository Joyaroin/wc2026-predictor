import { describe, it, expect } from 'vitest';
import type { Stage } from '@wc2026/shared';
import { predictedAdvancer, KO_ROUNDS, splitKnockoutBracket, type BracketMatchLike } from '../src/lib/bracket';

const match = (
  id: string,
  stage: Stage,
  homeCode: string | null,
  awayCode: string | null,
  kickoff = '2026-07-01T18:00:00.000Z',
): BracketMatchLike => ({
  id,
  stage,
  homeTeam: homeCode ?? 'TBD',
  homeCode,
  awayTeam: awayCode ?? 'TBD',
  awayCode,
  kickoff,
});

describe('predictedAdvancer', () => {
  it('picks the scoreline winner', () => {
    expect(predictedAdvancer({ home: 2, away: 1 })).toBe('HOME');
    expect(predictedAdvancer({ home: 0, away: 1 })).toBe('AWAY');
  });
  it('uses penWinner on a predicted draw', () => {
    expect(predictedAdvancer({ home: 1, away: 1, penWinner: 'AWAY' })).toBe('AWAY');
    expect(predictedAdvancer({ home: 0, away: 0, penWinner: 'HOME' })).toBe('HOME');
  });
  it('null for a draw with no pen winner, or no prediction', () => {
    expect(predictedAdvancer({ home: 1, away: 1 })).toBeNull();
    expect(predictedAdvancer(undefined)).toBeNull();
  });
});

describe('KO_ROUNDS', () => {
  it('is in tournament order', () => {
    expect(KO_ROUNDS.map((r) => r.stage)).toEqual(['LAST_32', 'LAST_16', 'QUARTER_FINALS', 'SEMI_FINALS', 'THIRD_PLACE', 'FINAL']);
  });
});

describe('splitKnockoutBracket', () => {
  it('traces resolved teams back to their R32 half and keeps fallback ties balanced', () => {
    const r32 = Array.from({ length: 16 }, (_, i) => {
      const n = i + 1;
      return match(String(n).padStart(2, '0'), 'LAST_32', n === 1 ? 'BRA' : `H${n}`, `A${n}`);
    });
    const bracket = splitKnockoutBracket([
      ...r32,
      match('101', 'QUARTER_FINALS', null, null),
      match('102', 'QUARTER_FINALS', null, null),
      match('103', 'QUARTER_FINALS', 'BRA', 'JPN'),
      match('104', 'QUARTER_FINALS', null, null),
    ]);

    const leftQf = bracket.left.find((c) => c.stage === 'QUARTER_FINALS')?.matches.map((m) => m.id);
    const rightQf = bracket.right.find((c) => c.stage === 'QUARTER_FINALS')?.matches.map((m) => m.id);

    expect(leftQf).toEqual(['101', '103']);
    expect(rightQf).toEqual(['102', '104']);
  });

  it('falls back to a normal stage split when no teams are known yet', () => {
    const bracket = splitKnockoutBracket([
      match('201', 'SEMI_FINALS', null, null),
      match('202', 'SEMI_FINALS', null, null),
    ]);

    expect(bracket.left.find((c) => c.stage === 'SEMI_FINALS')?.matches.map((m) => m.id)).toEqual(['201']);
    expect(bracket.right.find((c) => c.stage === 'SEMI_FINALS')?.matches.map((m) => m.id)).toEqual(['202']);
  });
});
