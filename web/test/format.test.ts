import { describe, it, expect } from 'vitest';
import { matchState, pointsLabel, stageLabel, formatKickoff, liveMinute, compareFixtures } from '../src/lib/format';
import type { Match } from '@wc2026/shared';

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

describe('compareFixtures', () => {
  const mk = (status: Match['status'], kickoff: string) => ({ status, kickoff });
  const order = (ms: { status: Match['status']; kickoff: string }[]) =>
    ms.slice().sort(compareFixtures).map((m) => m.kickoff);

  it('puts the live match first', () => {
    const live = mk('IN_PLAY', '2026-06-15T18:00:00Z');
    const upcoming = mk('TIMED', '2026-06-15T21:00:00Z');
    const done = mk('FINISHED', '2026-06-15T15:00:00Z');
    expect(order([done, upcoming, live])[0]).toBe(live.kickoff);
  });

  it('after the live match, the soonest match to predict is next; finished sink to the bottom', () => {
    const live = mk('IN_PLAY', '2026-06-15T18:00:00Z');
    const soon = mk('SCHEDULED', '2026-06-15T19:00:00Z');
    const later = mk('SCHEDULED', '2026-06-15T21:00:00Z');
    const done = mk('FINISHED', '2026-06-15T15:00:00Z');
    expect(order([done, later, soon, live])).toEqual([
      live.kickoff,
      soon.kickoff,
      later.kickoff,
      done.kickoff,
    ]);
  });

  it('when nothing is live, the next match to predict is on top', () => {
    const done = mk('FINISHED', '2026-06-15T15:00:00Z');
    const next = mk('SCHEDULED', '2026-06-15T19:00:00Z');
    expect(order([done, next])[0]).toBe(next.kickoff);
  });

  it('finished cards are newest-first at the bottom', () => {
    const early = mk('FINISHED', '2026-06-15T12:00:00Z');
    const late = mk('FINISHED', '2026-06-15T15:00:00Z');
    expect(order([early, late])).toEqual([late.kickoff, early.kickoff]);
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
