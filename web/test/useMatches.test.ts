import { describe, it, expect } from 'vitest';
import type { MatchView } from '../src/api/client';
import { matchesRefetchInterval } from '../src/api/useMatches';

const m = (status: MatchView['status']): MatchView =>
  ({ id: status, status, homeScore: null, awayScore: null } as unknown as MatchView);

describe('matchesRefetchInterval', () => {
  it('polls fast (30s) when a match is in play or paused', () => {
    expect(matchesRefetchInterval([m('SCHEDULED'), m('IN_PLAY')])).toBe(30_000);
    expect(matchesRefetchInterval([m('PAUSED')])).toBe(30_000);
  });
  it('polls slow (60s) when nothing is live', () => {
    expect(matchesRefetchInterval([m('SCHEDULED'), m('FINISHED')])).toBe(60_000);
  });
  it('polls slow (60s) with no data yet', () => {
    expect(matchesRefetchInterval(undefined)).toBe(60_000);
    expect(matchesRefetchInterval([])).toBe(60_000);
  });
});
