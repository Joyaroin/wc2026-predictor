import { describe, it, expect } from 'vitest';
import { createMemoryRepositories } from '../../src/repos/memory';
import { createScoringService } from '../../src/services/scoring';
import { sampleMatch } from '../support/testApp';

describe('scoringService.scoreMatch', () => {
  it('persists computePoints for each prediction of a finished match', async () => {
    const repos = createMemoryRepositories();
    await repos.matches.upsert(sampleMatch({ id: 'm1', status: 'FINISHED', homeScore: 2, awayScore: 1 }));

    const now = new Date().toISOString();
    await repos.predictions.put({ playerId: 'a', matchId: 'm1', home: 2, away: 1, points: 0, createdAt: now, updatedAt: now }); // exact → 12
    await repos.predictions.put({ playerId: 'b', matchId: 'm1', home: 3, away: 0, points: 0, createdAt: now, updatedAt: now }); // home win only → 2
    await repos.predictions.put({ playerId: 'c', matchId: 'm1', home: 0, away: 2, points: 0, createdAt: now, updatedAt: now }); // nothing right → 0

    const scoring = createScoringService(repos.predictions, repos.matches, repos.bracket);
    const count = await scoring.scoreMatch('m1');

    expect(count).toBe(3);
    expect((await repos.predictions.get('a', 'm1'))?.points).toBe(12);
    expect((await repos.predictions.get('b', 'm1'))?.points).toBe(2);
    expect((await repos.predictions.get('c', 'm1'))?.points).toBe(0);
  });

  it('does nothing when the match has no final score', async () => {
    const repos = createMemoryRepositories();
    await repos.matches.upsert(sampleMatch({ id: 'm2', status: 'SCHEDULED' }));
    const now = new Date().toISOString();
    await repos.predictions.put({ playerId: 'a', matchId: 'm2', home: 1, away: 1, points: 0, createdAt: now, updatedAt: now });
    const scoring = createScoringService(repos.predictions, repos.matches, repos.bracket);
    expect(await scoring.scoreMatch('m2')).toBe(0);
    expect((await repos.predictions.get('a', 'm2'))?.points).toBe(0);
  });
});
