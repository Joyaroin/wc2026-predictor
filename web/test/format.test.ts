import { describe, it, expect } from 'vitest';
import { matchState, pointsLabel, stageLabel, formatKickoff } from '../src/lib/format';

describe('matchState', () => {
  it('Played when finished with a score', () => {
    expect(matchState({ status: 'FINISHED', homeScore: 1, awayScore: 0, locked: true })).toBe('Played');
  });
  it('Live when in play', () => {
    expect(matchState({ status: 'IN_PLAY', homeScore: 0, awayScore: 0, locked: true })).toBe('Live');
    expect(matchState({ status: 'PAUSED', homeScore: 1, awayScore: 0, locked: true })).toBe('Live');
  });
  it('Locked when kickoff passed but not started/finished', () => {
    expect(matchState({ status: 'TIMED', homeScore: null, awayScore: null, locked: true })).toBe('Locked');
  });
  it('Open before kickoff', () => {
    expect(matchState({ status: 'SCHEDULED', homeScore: null, awayScore: null, locked: false })).toBe('Open');
  });
});

describe('formatKickoff timezone', () => {
  const iso = '2026-06-11T19:00:00Z';
  it('renders a zone label and respects the timezone', () => {
    const utc = formatKickoff(iso, 'UTC');
    expect(utc).toMatch(/UTC|GMT/);
    // Same instant in a different zone produces a different string.
    expect(formatKickoff(iso, 'America/New_York')).not.toBe(utc);
  });
});

describe('pointsLabel', () => {
  it('labels points additively', () => {
    expect(pointsLabel(12)).toContain('Exact');
    expect(pointsLabel(12)).toContain('12');
    expect(pointsLabel(5)).toBe('+5');
    expect(pointsLabel(2)).toBe('+2');
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
