import { describe, it, expect } from 'vitest';
import { matchState, pointsLabel, stageLabel, formatKickoff, liveMinute, liveFirstGoalBonus } from '../src/lib/format';

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
  it('Postponed for POSTPONED/SUSPENDED — not a normal upcoming fixture', () => {
    expect(matchState({ status: 'POSTPONED', homeScore: null, awayScore: null, locked: true })).toBe('Postponed');
    expect(matchState({ status: 'SUSPENDED', homeScore: 0, awayScore: 0, locked: true })).toBe('Postponed');
  });
  it('Cancelled for CANCELLED', () => {
    expect(matchState({ status: 'CANCELLED', homeScore: null, awayScore: null, locked: true })).toBe('Cancelled');
  });
  it('off-schedule statuses win over the locked flag (do not show as Locked/Open)', () => {
    expect(matchState({ status: 'POSTPONED', homeScore: null, awayScore: null, locked: false })).toBe('Postponed');
    expect(matchState({ status: 'CANCELLED', homeScore: null, awayScore: null, locked: false })).toBe('Cancelled');
  });
});

describe('liveFirstGoalBonus', () => {
  const fg = { firstTeam: 2, firstPlayer: 6 };

  it('is 0 when there is no first-goal result', () => {
    expect(liveFirstGoalBonus(null, { finished: true, goalless: true })).toBe(0);
    expect(liveFirstGoalBonus(null, { finished: false, goalless: false })).toBe(0);
  });
  it('suppresses the goalless auto-bonus while the match is still live (provisional 0-0)', () => {
    expect(liveFirstGoalBonus(fg, { finished: false, goalless: true })).toBe(0);
  });
  it('awards the full bonus for a goalless game once finished', () => {
    expect(liveFirstGoalBonus(fg, { finished: true, goalless: true })).toBe(8);
  });
  it('awards the bonus while live once a goal has been scored (facts are final)', () => {
    expect(liveFirstGoalBonus(fg, { finished: false, goalless: false })).toBe(8);
  });
  it('passes through partial bonuses', () => {
    expect(liveFirstGoalBonus({ firstTeam: 2, firstPlayer: 0 }, { finished: true, goalless: false })).toBe(2);
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

describe('liveMinute', () => {
  const kickoff = '2026-06-15T18:00:00Z';
  const at = (mins: number) => new Date(kickoff).getTime() + mins * 60_000;

  it('uses the provider minute when present', () => {
    expect(liveMinute({ status: 'IN_PLAY', minute: 37, kickoff })).toBe('37′');
  });
  it('shows HT while paused', () => {
    expect(liveMinute({ status: 'PAUSED', minute: 45, kickoff })).toBe('HT');
  });
  it('is null when not live', () => {
    expect(liveMinute({ status: 'TIMED', kickoff })).toBeNull();
    expect(liveMinute({ status: 'FINISHED', minute: 90, kickoff })).toBeNull();
  });
  it('estimates from kickoff when the provider omits the minute', () => {
    expect(liveMinute({ status: 'IN_PLAY', minute: null, kickoff }, at(20))).toBe('20′');
    expect(liveMinute({ status: 'IN_PLAY', minute: null, kickoff }, at(50))).toBe('45+′');
    // Second half: subtract the 15-minute break.
    expect(liveMinute({ status: 'IN_PLAY', minute: null, kickoff }, at(75))).toBe('60′');
    expect(liveMinute({ status: 'IN_PLAY', minute: null, kickoff }, at(110))).toBe('90+′');
  });
});

describe('pointsLabel', () => {
  it('labels points and marks exact via the flag (not a points heuristic)', () => {
    expect(pointsLabel(12, true)).toBe('Exact +12');
    expect(pointsLabel(13, false)).toBe('+13'); // non-exact 13 (5 + 2 + 6) must NOT say Exact
    expect(pointsLabel(5)).toBe('+5');
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
