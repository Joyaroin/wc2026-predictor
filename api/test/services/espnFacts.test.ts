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
      async fetchMatchStats() { return null; },
      async fetchMatchOdds() { return null; },
      async fetchMatchFirstGoals() {
        return [{ date: '2026-06-15T18:00:00.000Z', homeName: 'Brazil', awayName: 'South Korea', first: { side: 'HOME', scorerId: '7', scorerName: 'Neymar' }, minute: null, finished: true }];
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

  it('ingests live minute + first goal mid-match, and re-scores first team', async () => {
    const repos = createMemoryRepositories();
    await repos.matches.upsert(
      sampleMatch({ id: 'm2', status: 'IN_PLAY', homeScore: 0, awayScore: 1, homeTeam: 'Qatar', homeCode: 'QAT', awayTeam: 'Switzerland', awayCode: 'SUI', kickoff: '2026-06-13T19:00:00.000Z' }),
    );
    const now = new Date().toISOString();
    await repos.predictions.put({ playerId: 'kiki', matchId: 'm2', home: 1, away: 2, firstTeam: 'AWAY', points: 0, createdAt: now, updatedAt: now });

    const scoring = createScoringService(repos.predictions, repos.matches, repos.bracket);
    const fakeEspn: EspnClient = {
      async fetchPlayerPool() { return []; },
      async fetchFinishedEventGoals() { return []; },
      async fetchMatchStats() { return null; },
      async fetchMatchOdds() { return null; },
      async fetchMatchFirstGoals() {
        return [{ date: '2026-06-13T19:00:00.000Z', homeName: 'Qatar', awayName: 'Switzerland', first: { side: 'AWAY', scorerId: '9', scorerName: 'Embolo' }, minute: 50, finished: false }];
      },
    };

    const facts = createEspnFactsService(fakeEspn, repos.matches, scoring, fixedClock('2026-06-13T19:50:00.000Z'), noopLogger);
    await facts.ingest();

    const m = await repos.matches.getById('m2');
    expect(m?.minute).toBe(50);
    expect(m?.firstGoalTeam).toBe('AWAY');
    // live 0-1 vs pred 1-2: outcome (+2) + goal margin (+3) + first team AWAY (+2) = 7
    expect((await repos.predictions.get('kiki', 'm2'))?.points).toBe(7);
  });

  it('does not lock in "NONE" for a live, still-goalless match', async () => {
    const repos = createMemoryRepositories();
    await repos.matches.upsert(
      sampleMatch({ id: 'm3', status: 'IN_PLAY', homeScore: 0, awayScore: 0, homeTeam: 'Qatar', homeCode: 'QAT', awayTeam: 'Switzerland', awayCode: 'SUI', kickoff: '2026-06-13T19:00:00.000Z' }),
    );
    const scoring = createScoringService(repos.predictions, repos.matches, repos.bracket);
    const fakeEspn: EspnClient = {
      async fetchPlayerPool() { return []; },
      async fetchFinishedEventGoals() { return []; },
      async fetchMatchStats() { return null; },
      async fetchMatchOdds() { return null; },
      async fetchMatchFirstGoals() {
        return [{ date: '2026-06-13T19:00:00.000Z', homeName: 'Qatar', awayName: 'Switzerland', first: null, minute: 20, finished: false }];
      },
    };
    const facts = createEspnFactsService(fakeEspn, repos.matches, scoring, fixedClock('2026-06-13T19:20:00.000Z'), noopLogger);
    await facts.ingest();

    const m = await repos.matches.getById('m3');
    expect(m?.minute).toBe(20);
    expect(m?.firstGoalTeam ?? null).toBeNull(); // not 'NONE' — a goal can still come
  });
});
