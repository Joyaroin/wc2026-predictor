import { describe, it, expect, vi } from 'vitest';
import { createMatchesCache } from '../../src/lib/matchesCache';
import { fixedClock } from '../../src/lib/clock';
import type { MatchView } from '../../src/services/dtos';

const sample = (over: Partial<MatchView> = {}): MatchView => ({
  id: 'm1', stage: 'GROUP_STAGE', groupName: 'A', matchday: 1,
  homeTeam: 'Argentina', homeCode: 'ARG', awayTeam: 'Brazil', awayCode: 'BRA',
  kickoff: '2026-06-12T00:00:00.000Z', status: 'IN_PLAY', startedAt: null, minute: 10,
  homeScore: 1, awayScore: 0, winner: null, locked: true, ...over,
}) as MatchView;

describe('matchesCache', () => {
  it('caches within TTL and reloads after expiry', async () => {
    const clock = fixedClock(new Date('2026-06-12T00:00:00.000Z'));
    const cache = createMatchesCache(5_000, clock);
    const loader = vi.fn().mockResolvedValue([sample()]);
    const a = await cache.get(loader);
    const b = await cache.get(loader);
    expect(loader).toHaveBeenCalledTimes(1); // second call served from cache
    expect(a.etag).toBe(b.etag);
  });

  it('produces a different etag when data changes', async () => {
    const clock = fixedClock(new Date('2026-06-12T00:00:00.000Z'));
    const cache1 = createMatchesCache(0, clock);
    const first = await cache1.get(async () => [sample({ homeScore: 1 })]);
    const second = await cache1.get(async () => [sample({ homeScore: 2 })]);
    expect(first.etag).not.toBe(second.etag);
  });
});
