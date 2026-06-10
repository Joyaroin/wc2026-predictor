import { describe, it, expect } from 'vitest';
import { darkHorseMultiplier, darkHorsePoints } from '../src/darkHorse';

describe('darkHorseMultiplier', () => {
  it('is ~1 for favourites and capped at 10 for long shots', () => {
    expect(darkHorseMultiplier('FRA')).toBe(1); // 18.6%
    expect(darkHorseMultiplier('GER')).toBe(2); // 5.9%
    expect(darkHorseMultiplier('MEX')).toBe(6); // 1.8%
    expect(darkHorseMultiplier('IRN')).toBe(10); // 0.1% → capped
    expect(darkHorseMultiplier('HAI')).toBe(10);
  });
  it('falls back for unknown/placeholder teams', () => {
    expect(darkHorseMultiplier(null)).toBe(5); // 10 / 2.0 fallback
    expect(darkHorseMultiplier('ZZZ')).toBe(5);
  });
});

describe('darkHorsePoints', () => {
  it('multiplies round weight by the dark-horse multiplier', () => {
    expect(darkHorsePoints('FINAL', 'FRA')).toBe(5); // 5 × 1
    expect(darkHorsePoints('FINAL', 'MEX')).toBe(30); // 5 × 6
    expect(darkHorsePoints('LAST_32', 'HAI')).toBe(10); // 1 × 10
    expect(darkHorsePoints('QUARTER_FINALS', 'MEX')).toBe(18); // 3 × 6
    expect(darkHorsePoints('GROUP_STAGE', 'MEX')).toBe(0);
  });
});
