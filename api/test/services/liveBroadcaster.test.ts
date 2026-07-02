import { describe, it, expect } from 'vitest';
import { createLiveBroadcaster } from '../../src/services/liveBroadcaster';
import type { MatchView } from '../../src/services/dtos';

const m = (over: Partial<MatchView>): MatchView => ({
  id: 'm1', stage: 'GROUP_STAGE', groupName: 'A', matchday: 1,
  homeTeam: 'Argentina', homeCode: 'ARG', awayTeam: 'Brazil', awayCode: 'BRA',
  kickoff: '2026-06-12T00:00:00.000Z', status: 'IN_PLAY', startedAt: null, minute: 10,
  homeScore: 0, awayScore: 0, winner: null, locked: true, ...over,
}) as MatchView;

describe('liveBroadcaster', () => {
  it('seeds silently on first tick, then emits a score event on change', async () => {
    let data: MatchView[] = [m({ homeScore: 0, awayScore: 0 })];
    const b = createLiveBroadcaster(async () => data);
    expect(await b.tickOnce()).toEqual([]); // seed
    data = [m({ homeScore: 1, awayScore: 0 })];
    const events = await b.tickOnce();
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'score', matchId: 'm1', home: 1, away: 0 }),
    );
  });

  it('delivers events to subscribers and stops after unsubscribe', async () => {
    let data: MatchView[] = [m({ minute: 10 })];
    const b = createLiveBroadcaster(async () => data);
    const seen: unknown[] = [];
    const off = b.subscribe((e) => seen.push(e));
    await b.tickOnce(); // seed
    data = [m({ minute: 11 })];
    await b.tickOnce();
    off();
    data = [m({ minute: 12 })];
    await b.tickOnce();
    expect(seen).toHaveLength(1); // only the minute 10->11 change
  });
});
