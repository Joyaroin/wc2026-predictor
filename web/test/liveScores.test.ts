import { describe, it, expect } from 'vitest';
import { applyLiveEvent } from '../src/hooks/useLiveScores';
import type { MatchView } from '../src/api/client';

const base: MatchView = {
  id: 'm1', stage: 'GROUP_STAGE', groupName: 'A', matchday: 1,
  homeTeam: 'Argentina', homeCode: 'ARG', awayTeam: 'Brazil', awayCode: 'BRA',
  kickoff: '2026-06-12T00:00:00.000Z', status: 'IN_PLAY', startedAt: null, minute: 10,
  homeScore: 0, awayScore: 0, winner: null, locked: true,
} as MatchView;

describe('applyLiveEvent', () => {
  it('patches the matching match score immutably', () => {
    const list = [base];
    const next = applyLiveEvent(list, { type: 'score', matchId: 'm1', home: 1, away: 0, status: 'IN_PLAY', minute: 12 });
    expect(next[0]!.homeScore).toBe(1);
    expect(next[0]!.minute).toBe(12);
    expect(next).not.toBe(list); // new array reference
    expect(list[0]!.homeScore).toBe(0); // original untouched
  });
  it('returns the same list when no match id matches', () => {
    const list = [base];
    const next = applyLiveEvent(list, { type: 'score', matchId: 'zzz', home: 9, away: 9, status: 'IN_PLAY', minute: 1 });
    expect(next).toBe(list);
  });
});
