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

    const scoring = createScoringService(repos.predictions, repos.matches, repos.bracket, fixedClock(now));
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

  it('back-fills FINISHED matches still missing firstGoalTeam even outside the recent window', async () => {
    const repos = createMemoryRepositories();
    // Old finished match (kicked off 30 days before "now") with a score but NO first-goal fact yet —
    // its date is far outside the recent 3-day sweep, so only the back-fill path can recover it.
    await repos.matches.upsert(
      sampleMatch({ id: 'old', status: 'FINISHED', homeScore: 1, awayScore: 0, homeTeam: 'Brazil', homeCode: 'BRA', awayTeam: 'Korea', awayCode: 'KOR', kickoff: '2026-06-15T18:00:00.000Z' }),
    );
    const now = new Date('2026-07-15T00:00:00.000Z'); // ~30 days later

    const requestedDates: string[][] = [];
    const fakeEspn: EspnClient = {
      async fetchPlayerPool() { return []; },
      async fetchFinishedEventGoals() { return []; },
      async fetchMatchFirstGoals(dates) {
        requestedDates.push(dates);
        return [{ date: '2026-06-15T18:00:00.000Z', homeName: 'Brazil', awayName: 'South Korea', first: { side: 'HOME', scorerId: '7', scorerName: 'Neymar' } }];
      },
    };

    const scoring = createScoringService(repos.predictions, repos.matches, repos.bracket, fixedClock(now.toISOString()));
    const facts = createEspnFactsService(fakeEspn, repos.matches, scoring, fixedClock(now.toISOString()), noopLogger);
    await facts.ingest();

    // The old match's date was fetched despite being outside the recent window.
    expect(requestedDates[0]).toContain('20260615');
    const m = await repos.matches.getById('old');
    expect(m?.firstGoalTeam).toBe('HOME');
    expect(m?.firstScorerId).toBe('7');
  });

  it('does not back-fill a match that already has a firstGoalTeam', async () => {
    const repos = createMemoryRepositories();
    await repos.matches.upsert(
      sampleMatch({ id: 'done', status: 'FINISHED', homeScore: 1, awayScore: 0, firstGoalTeam: 'HOME', homeTeam: 'Brazil', homeCode: 'BRA', awayTeam: 'Korea', awayCode: 'KOR', kickoff: '2026-06-15T18:00:00.000Z' }),
    );
    const now = new Date('2026-07-15T00:00:00.000Z');

    const requestedDates: string[][] = [];
    const fakeEspn: EspnClient = {
      async fetchPlayerPool() { return []; },
      async fetchFinishedEventGoals() { return []; },
      async fetchMatchFirstGoals(dates) { requestedDates.push(dates); return []; },
    };
    const scoring = createScoringService(repos.predictions, repos.matches, repos.bracket, fixedClock(now.toISOString()));
    const facts = createEspnFactsService(fakeEspn, repos.matches, scoring, fixedClock(now.toISOString()), noopLogger);
    await facts.ingest();

    // Only the recent 3-day window is fetched; the already-resolved old date is NOT added.
    expect(requestedDates[0]).not.toContain('20260615');
  });
});
