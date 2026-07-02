import { describe, it, expect } from 'vitest';
import { scoreChanged } from '../src/hooks/useScoreFlash';

describe('scoreChanged', () => {
  it('is false on the seed (prev null)', () => {
    expect(scoreChanged(null, { h: 0, a: 0 })).toBe(false);
  });
  it('is true when the home or away score differs', () => {
    expect(scoreChanged({ h: 0, a: 0 }, { h: 1, a: 0 })).toBe(true);
    expect(scoreChanged({ h: 1, a: 0 }, { h: 1, a: 1 })).toBe(true);
  });
  it('is false when the score is unchanged', () => {
    expect(scoreChanged({ h: 2, a: 1 }, { h: 2, a: 1 })).toBe(false);
  });
});
