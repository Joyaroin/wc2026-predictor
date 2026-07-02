import { describe, it, expect } from 'vitest';
import { onGoal, emitGoal } from '../src/lib/liveStream';
import { goalMessage } from '../src/hooks/useLiveScores';
import type { MatchView } from '../src/api/client';

const match = (over: Partial<MatchView> = {}): MatchView => ({
  id: 'm1', stage: 'GROUP_STAGE', groupName: 'A', matchday: 1,
  homeTeam: 'Argentina', homeCode: 'ARG', awayTeam: 'Brazil', awayCode: 'BRA',
  kickoff: '2026-06-12T00:00:00.000Z', status: 'IN_PLAY', startedAt: null, minute: 10,
  homeScore: 1, awayScore: 1, winner: null, locked: true, ...over,
}) as MatchView;

describe('goal event bus', () => {
  it('delivers to subscribers until unsubscribed', () => {
    const seen: string[] = [];
    const off = onGoal((m) => seen.push(m));
    emitGoal('a');
    off();
    emitGoal('b');
    expect(seen).toEqual(['a']);
  });
});

describe('goalMessage', () => {
  it('returns a label when the total rises', () => {
    const prev = match({ homeScore: 1, awayScore: 1 });
    const msg = goalMessage(prev, { type: 'score', matchId: 'm1', home: 2, away: 1, status: 'IN_PLAY', minute: 55 });
    expect(msg).toContain('GOAL');
    expect(msg).toContain('ARG');
  });
  it('returns null when the total does not rise (correction/no goal)', () => {
    const prev = match({ homeScore: 2, awayScore: 1 });
    expect(goalMessage(prev, { type: 'score', matchId: 'm1', home: 1, away: 1, status: 'IN_PLAY', minute: 55 })).toBeNull();
  });
  it('returns null for non-score events and unknown matches', () => {
    expect(goalMessage(match(), { type: 'minute', matchId: 'm1', home: 1, away: 1, status: 'IN_PLAY', minute: 12 })).toBeNull();
    expect(goalMessage(undefined, { type: 'score', matchId: 'zzz', home: 9, away: 0, status: 'IN_PLAY', minute: 1 })).toBeNull();
  });
});
