import { describe, it, expect } from 'vitest';
import { computeSections } from '../src/sections';
import type { Match, Stage } from '../src/types';

const m = (id: string, stage: Stage, kickoff: string, homeCode: string, awayCode: string): Match => ({
  id,
  stage,
  groupName: stage === 'GROUP_STAGE' ? 'A' : null,
  matchday: 1,
  homeTeam: homeCode,
  homeCode,
  awayTeam: awayCode,
  awayCode,
  kickoff,
  status: 'SCHEDULED',
  homeScore: null,
  awayScore: null,
  placeholder: false,
});

describe('computeSections', () => {
  it('splits the group stage into 3 weeks by boundary fixtures and one section per knockout round', () => {
    const matches = [
      m('a', 'GROUP_STAGE', '2026-06-11T16:00:00Z', 'MEX', 'RSA'),
      m('b', 'GROUP_STAGE', '2026-06-13T16:00:00Z', 'UZB', 'COL'), // MW1 end (inclusive)
      m('c', 'GROUP_STAGE', '2026-06-15T16:00:00Z', 'CZE', 'RSA'), // MW2 start
      m('d', 'GROUP_STAGE', '2026-06-18T16:00:00Z', 'COL', 'COD'), // MW2 end
      m('e', 'GROUP_STAGE', '2026-06-20T16:00:00Z', 'SUI', 'CAN'), // MW3 start (inclusive)
      m('f', 'GROUP_STAGE', '2026-06-22T16:00:00Z', 'BRA', 'MAR'),
      m('k', 'LAST_32', '2026-06-28T16:00:00Z', 'BRA', 'MEX'),
      m('q', 'QUARTER_FINALS', '2026-07-10T16:00:00Z', 'x', 'y'),
      m('t', 'THIRD_PLACE', '2026-07-18T16:00:00Z', 'x', 'y'),
      m('fin', 'FINAL', '2026-07-19T16:00:00Z', 'x', 'y'),
    ];
    const s = computeSections(matches);
    expect(s.get('a')).toBe('MW1');
    expect(s.get('b')).toBe('MW1');
    expect(s.get('c')).toBe('MW2');
    expect(s.get('d')).toBe('MW2');
    expect(s.get('e')).toBe('MW3');
    expect(s.get('f')).toBe('MW3');
    expect(s.get('k')).toBe('LAST_32');
    expect(s.get('q')).toBe('QUARTER_FINALS');
    expect(s.get('t')).toBe('FINAL'); // 3rd place sits with the final
    expect(s.get('fin')).toBe('FINAL');
  });
});
