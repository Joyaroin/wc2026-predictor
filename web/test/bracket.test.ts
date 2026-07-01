import { describe, it, expect } from 'vitest';
import { predictedAdvancer, KO_ROUNDS } from '../src/lib/bracket';

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
