import { describe, it, expect } from 'vitest';
import { createMemoryRepositories } from '../../src/repos/memory';
import { createMatchService } from '../../src/services/matches';
import { createPredictionService } from '../../src/services/predictions';
import { fixedClock } from '../../src/lib/clock';
import { sampleMatch } from '../support/testApp';
import { ConflictError } from '../../src/lib/errors';

describe('predictionService.setJoker', () => {
  // Regression: the old loop cleared other Jokers as it iterated, so hitting a locked conflict
  // partway through persisted a clear AND threw — leaving zero Jokers + an error. The fix scans
  // for conflicts BEFORE any write, so a conflict leaves the existing Joker fully intact.
  it('validates before writing: a locked conflicting Joker is left intact and the call throws', async () => {
    const repos = createMemoryRepositories();
    // now is after A's kickoff (locked) but before B's (open); both are matchweek 1.
    const clock = fixedClock(new Date('2026-06-15T20:00:00.000Z'));
    const matches = createMatchService(repos.matches, clock);
    const predictions = createPredictionService(repos.predictions, matches, repos.memberships, repos.players, clock);

    await repos.matches.upsert(sampleMatch({ id: 'A', stage: 'GROUP_STAGE', matchday: 1, kickoff: '2026-06-15T18:00:00.000Z', homeCode: 'CAN', awayCode: 'BIH' }));
    await repos.matches.upsert(sampleMatch({ id: 'B', stage: 'GROUP_STAGE', matchday: 1, kickoff: '2026-06-15T22:00:00.000Z', homeCode: 'MEX', awayCode: 'RSA' }));

    const t = new Date('2026-06-10T00:00:00.000Z').toISOString();
    // Joker committed on the now-locked match A; a plain prediction exists on the open match B.
    await repos.predictions.put({ playerId: 'sam', matchId: 'A', home: 1, away: 0, joker: true, points: 0, createdAt: t, updatedAt: t });
    await repos.predictions.put({ playerId: 'sam', matchId: 'B', home: 2, away: 1, joker: false, points: 0, createdAt: t, updatedAt: t });

    await expect(predictions.setJoker('sam', 'B', true)).rejects.toBeInstanceOf(ConflictError);

    // The locked match keeps its Joker; the target never gets one. No write happened at all.
    expect((await repos.predictions.get('sam', 'A'))?.joker).toBe(true);
    expect((await repos.predictions.get('sam', 'B'))?.joker).toBe(false);
  });

  it('moves a Joker between two open matches in a section, clearing the previous holder', async () => {
    const repos = createMemoryRepositories();
    const clock = fixedClock(new Date('2026-06-10T00:00:00.000Z'));
    const matches = createMatchService(repos.matches, clock);
    const predictions = createPredictionService(repos.predictions, matches, repos.memberships, repos.players, clock);

    await repos.matches.upsert(sampleMatch({ id: 'A', stage: 'GROUP_STAGE', matchday: 1, kickoff: '2026-06-15T18:00:00.000Z', homeCode: 'CAN', awayCode: 'BIH' }));
    await repos.matches.upsert(sampleMatch({ id: 'B', stage: 'GROUP_STAGE', matchday: 1, kickoff: '2026-06-15T22:00:00.000Z', homeCode: 'MEX', awayCode: 'RSA' }));

    const t = new Date('2026-06-09T00:00:00.000Z').toISOString();
    await repos.predictions.put({ playerId: 'sam', matchId: 'A', home: 1, away: 0, joker: true, points: 0, createdAt: t, updatedAt: t });
    await repos.predictions.put({ playerId: 'sam', matchId: 'B', home: 2, away: 1, joker: false, points: 0, createdAt: t, updatedAt: t });

    const updated = await predictions.setJoker('sam', 'B', true);
    expect(updated.joker).toBe(true);
    expect((await repos.predictions.get('sam', 'A'))?.joker).toBe(false);
    expect((await repos.predictions.get('sam', 'B'))?.joker).toBe(true);
  });
});
