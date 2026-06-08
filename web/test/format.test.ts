import { describe, it, expect } from 'vitest';
import { matchState, pointsLabel, stageLabel } from '../src/lib/format';

describe('matchState', () => {
  it('Played when finished with a score', () => {
    expect(matchState({ status: 'FINISHED', homeScore: 1, awayScore: 0, locked: true })).toBe('Played');
  });
  it('Locked when kickoff passed but not finished', () => {
    expect(matchState({ status: 'IN_PLAY', homeScore: null, awayScore: null, locked: true })).toBe('Locked');
  });
  it('Open before kickoff', () => {
    expect(matchState({ status: 'SCHEDULED', homeScore: null, awayScore: null, locked: false })).toBe('Open');
  });
});

describe('pointsLabel', () => {
  it('labels each tier', () => {
    expect(pointsLabel(5)).toContain('Exact');
    expect(pointsLabel(3)).toContain('Goal diff');
    expect(pointsLabel(2)).toContain('Result');
    expect(pointsLabel(0)).toBe('+0');
  });
});

describe('stageLabel', () => {
  it('names group and knockout stages', () => {
    expect(stageLabel('GROUP_STAGE', 'C')).toBe('Group C');
    expect(stageLabel('LAST_32', null)).toBe('Round of 32');
    expect(stageLabel('FINAL', null)).toBe('Final');
  });
});
