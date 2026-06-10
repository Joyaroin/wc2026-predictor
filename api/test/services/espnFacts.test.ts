import { describe, it, expect } from 'vitest';
import { createMemoryRepositories } from '../../src/repos/memory';
import { createScoringService } from '../../src/services/scoring';
import { createEspnFactsService } from '../../src/services/espnFacts';
import type { EspnClient } from '../../src/integration/espnClient';
import type { Logger } from '../../src/lib/logger';
import { sampleMatch } from '../support/testApp';

const noopLogger = { info() {}, warn() {}, error() {}, debug() {} } as unknown as Logger;
const fixedClock = (iso: string) => ({ now: () => new Date(iso) });

describe('espnFacts.ingest', () => {
  it('maps ESPN first goal to our match (alias names) and re-scores first-team/first-player', async () => {
    const repos = createMemoryRepositories();
    await repos.matches.upsert(
      sampleMatch({ id: 'm1', status: 'FINISHED', homeScore: 2, awayScore: 1, homeTeam: 'Brazil', homeCode: 'BRA', awayTeam: 'Korea', awayCode: 'KOR', kickoff: '2026-06-15T18:00:00.000Z' }),
    );
    const now = new Date().toISOString();
    // Exact scoreline (12) + first team HOME + first scorer '7'
    await repos.predictions.put({ playerId: 'sam', matchId: 'm1', home: 2, away: 1, firstTeam: 'HOME', firstScorerId: '7', points: 0, createdAt: now, updatedAt: now });

    const scoring = createScoringService(repos.predictions, repos.matches, repos.bracket);
    const fakeEspn: EspnClient = {
      async fetchPlayerPool() { return []; },
      async fetchFinishedEventGoals() { return []; },
      async fetchMatchFirstGoals() {
        return [{ date: '2026-06-15T18:00:00.000Z', homeName: 'Brazil', awayName: 'South Korea', first: { side: 'HOME', scorerId: '7', scorerName: 'Neymar' } }];
      },
    };

    const facts = createEspnFactsService(fakeEspn, repos.matches, scoring, fixedClock('2026-06-16T00:00:00.000Z'), noopLogger);
    await facts.ingest();

    const m = await repos.matches.getById('m1');
    expect(m?.firstGoalTeam).toBe('HOME');
    expect(m?.firstScorerId).toBe('7');

    // 12 (exact) + 2 (first team) + 6 (first scorer) = 20
    expect((await repos.predictions.get('sam', 'm1'))?.points).toBe(20);
    expect((await repos.predictions.get('sam', 'm1'))?.exact).toBe(true);
  });
});
