import { describe, it, expect } from 'vitest';
import { createMemoryRepositories } from '../../src/repos/memory';
import { createScoringService } from '../../src/services/scoring';
import { systemClock } from '../../src/lib/clock';
import { sampleMatch } from '../support/testApp';

describe('scoringService.scoreMatch', () => {
  it('persists computePoints for each prediction of a finished match', async () => {
    const repos = createMemoryRepositories();
    await repos.matches.upsert(sampleMatch({ id: 'm1', status: 'FINISHED', homeScore: 2, awayScore: 1 }));

    const now = new Date().toISOString();
    await repos.predictions.put({ playerId: 'a', matchId: 'm1', home: 2, away: 1, points: 0, createdAt: now, updatedAt: now }); // exact → 12
    await repos.predictions.put({ playerId: 'b', matchId: 'm1', home: 3, away: 0, points: 0, createdAt: now, updatedAt: now }); // home win only → 2
    await repos.predictions.put({ playerId: 'c', matchId: 'm1', home: 0, away: 2, points: 0, createdAt: now, updatedAt: now }); // nothing right → 0

    const scoring = createScoringService(repos.predictions, repos.matches, repos.bracket, systemClock);
    const count = await scoring.scoreMatch('m1');

    expect(count).toBe(3);
    expect((await repos.predictions.get('a', 'm1'))?.points).toBe(12);
    expect((await repos.predictions.get('b', 'm1'))?.points).toBe(2);
    expect((await repos.predictions.get('c', 'm1'))?.points).toBe(0);
  });

  it('a correctly-predicted 0-0 earns the full 20 (no first scorer to miss)', async () => {
    const repos = createMemoryRepositories();
    await repos.matches.upsert(sampleMatch({ id: 'm1', status: 'FINISHED', homeScore: 0, awayScore: 0, firstGoalTeam: 'NONE' }));
    const now = new Date().toISOString();
    await repos.predictions.put({ playerId: 'a', matchId: 'm1', home: 0, away: 0, points: 0, createdAt: now, updatedAt: now }); // exact 0-0 → 20
    await repos.predictions.put({ playerId: 'b', matchId: 'm1', home: 1, away: 1, points: 0, createdAt: now, updatedAt: now }); // draw, wrong score → 5

    const scoring = createScoringService(repos.predictions, repos.matches, repos.bracket, systemClock);
    await scoring.scoreMatch('m1');

    expect((await repos.predictions.get('a', 'm1'))?.points).toBe(20);
    expect((await repos.predictions.get('a', 'm1'))?.exact).toBe(true);
    expect((await repos.predictions.get('b', 'm1'))?.points).toBe(5); // outcome 2 + goal diff 3, no 0-0 bonus
  });

  it('suppresses the provisional goalless first-goal bonus while a 0-0 match is still live', async () => {
    const repos = createMemoryRepositories();
    await repos.matches.upsert(sampleMatch({ id: 'live', status: 'IN_PLAY', homeScore: 0, awayScore: 0 }));
    const now = new Date().toISOString();
    await repos.predictions.put({ playerId: 'a', matchId: 'live', home: 0, away: 0, points: 0, createdAt: now, updatedAt: now });

    const scoring = createScoringService(repos.predictions, repos.matches, repos.bracket, systemClock);
    await scoring.scoreMatch('live');

    // Live 0-0: scoreline points only (12). The +8 goalless first-goal bonus is volatile (one goal
    // removes it) and must not be persisted until FINISHED — so the leaderboard/My Points agree
    // with the live MatchCard, which suppresses it too.
    expect((await repos.predictions.get('a', 'live'))?.points).toBe(12);
  });

  it('persists correctOutcome, distinguishing a wrong-outcome 2-pointer from a correct result', async () => {
    const repos = createMemoryRepositories();
    // actual 0-1 (AWAY win)
    await repos.matches.upsert(sampleMatch({ id: 'm3', status: 'FINISHED', homeScore: 0, awayScore: 1 }));
    const now = new Date().toISOString();
    // predicts 2-1 (HOME win) — away goals match (1==1) → 2 points, but outcome is WRONG
    await repos.predictions.put({ playerId: 'a', matchId: 'm3', home: 2, away: 1, points: 0, createdAt: now, updatedAt: now });
    // predicts 0-2 (AWAY win) — correct outcome, away goals wrong → 2 points (outcome) and correctOutcome true
    await repos.predictions.put({ playerId: 'b', matchId: 'm3', home: 0, away: 2, points: 0, createdAt: now, updatedAt: now });

    const scoring = createScoringService(repos.predictions, repos.matches, repos.bracket, systemClock);
    await scoring.scoreMatch('m3');

    const a = await repos.predictions.get('a', 'm3');
    const b = await repos.predictions.get('b', 'm3');
    expect(a?.points).toBe(2); // away-goal match only
    expect(a?.correctOutcome).toBe(false); // wrong outcome — must NOT count as a correct result
    expect(b?.correctOutcome).toBe(true); // right outcome
  });

  it('does nothing when the match has no final score', async () => {
    const repos = createMemoryRepositories();
    await repos.matches.upsert(sampleMatch({ id: 'm2', status: 'SCHEDULED' }));
    const now = new Date().toISOString();
    await repos.predictions.put({ playerId: 'a', matchId: 'm2', home: 1, away: 1, points: 0, createdAt: now, updatedAt: now });
    const scoring = createScoringService(repos.predictions, repos.matches, repos.bracket, systemClock);
    expect(await scoring.scoreMatch('m2')).toBe(0);
    expect((await repos.predictions.get('a', 'm2'))?.points).toBe(0);
  });
});
