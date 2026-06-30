import { describe, it, expect } from 'vitest';
import { mapToDomain, createFootballApiClient, type ProviderMatch } from '../../src/integration/footballApiClient';
import { ConfigError } from '../../src/lib/config';
import { testConfig } from '../support/testApp';
import type { Logger } from '../../src/lib/logger';

const noopLogger: Logger = { info: () => {}, warn: () => {}, error: () => {}, child: () => noopLogger };

describe('mapToDomain', () => {
  it('maps a normal group match', () => {
    const pm: ProviderMatch = {
      id: 12,
      stage: 'GROUP_STAGE',
      group: 'GROUP_A',
      matchday: 1,
      utcDate: '2026-06-15T18:00:00Z',
      status: 'FINISHED',
      homeTeam: { name: 'Brazil', tla: 'BRA' },
      awayTeam: { name: 'Argentina', tla: 'ARG' },
      score: { fullTime: { home: 2, away: 1 } },
    };
    expect(mapToDomain(pm)).toEqual({
      id: '12',
      stage: 'GROUP_STAGE',
      groupName: 'A',
      matchday: 1,
      homeTeam: 'Brazil',
      homeCode: 'BRA',
      awayTeam: 'Argentina',
      awayCode: 'ARG',
      kickoff: '2026-06-15T18:00:00Z',
      status: 'FINISHED',
      minute: null,
      homeScore: 2,
      awayScore: 1,
      winner: null,
      penaltyHome: null,
      penaltyAway: null,
      placeholder: false,
    });
  });

  it('maps the knockout winner (incl. penalty outcomes)', () => {
    const pm: ProviderMatch = {
      id: 50,
      stage: 'LAST_16',
      utcDate: '2026-07-01T18:00:00Z',
      status: 'FINISHED',
      homeTeam: { name: 'Brazil' },
      awayTeam: { name: 'Korea' },
      score: { winner: 'HOME_TEAM', fullTime: { home: 1, away: 1 } },
    };
    expect(mapToDomain(pm).winner).toBe('HOME');
  });

  it('uses the pre-penalty score (regularTime + extraTime), not fullTime, for a shootout', () => {
    // football-data.org folds the shootout into score.fullTime for PENALTY_SHOOTOUT matches;
    // the real result is the end-of-normal/extra-time draw (regularTime + extraTime).
    const pm: ProviderMatch = {
      id: 51,
      stage: 'LAST_32',
      utcDate: '2026-07-01T18:00:00Z',
      status: 'FINISHED',
      homeTeam: { name: 'Netherlands' },
      awayTeam: { name: 'Morocco' },
      score: {
        winner: 'AWAY_TEAM',
        duration: 'PENALTY_SHOOTOUT',
        fullTime: { home: 3, away: 4 }, // 1-1 plus a 2-3 shootout
        regularTime: { home: 1, away: 1 },
        extraTime: { home: 0, away: 0 },
        penalties: { home: 2, away: 3 },
      },
    };
    const m = mapToDomain(pm);
    expect(m.homeScore).toBe(1);
    expect(m.awayScore).toBe(1);
    expect(m.winner).toBe('AWAY');
  });

  it('adds extra-time goals into the pre-penalty score for a shootout', () => {
    const pm: ProviderMatch = {
      id: 52,
      stage: 'QUARTER_FINALS',
      utcDate: '2026-07-04T18:00:00Z',
      status: 'FINISHED',
      homeTeam: { name: 'Germany' },
      awayTeam: { name: 'Paraguay' },
      score: {
        winner: 'AWAY_TEAM',
        duration: 'PENALTY_SHOOTOUT',
        fullTime: { home: 4, away: 5 }, // 2-2 (1-1 + 1-1 ET) plus a 2-3 shootout
        regularTime: { home: 1, away: 1 },
        extraTime: { home: 1, away: 1 },
        penalties: { home: 2, away: 3 },
      },
    };
    const m = mapToDomain(pm);
    expect(m.homeScore).toBe(2);
    expect(m.awayScore).toBe(2);
  });

  it('captures the shootout score (penaltyHome/penaltyAway)', () => {
    const pm: ProviderMatch = {
      id: 54,
      stage: 'LAST_32',
      utcDate: '2026-07-01T18:00:00Z',
      status: 'FINISHED',
      homeTeam: { name: 'Netherlands' },
      awayTeam: { name: 'Morocco' },
      score: {
        winner: 'AWAY_TEAM',
        duration: 'PENALTY_SHOOTOUT',
        fullTime: { home: 3, away: 4 },
        regularTime: { home: 1, away: 1 },
        extraTime: { home: 0, away: 0 },
        penalties: { home: 2, away: 3 },
      },
    };
    const m = mapToDomain(pm);
    expect(m.penaltyHome).toBe(2);
    expect(m.penaltyAway).toBe(3);
  });

  it('leaves penalties null for a normal match', () => {
    const pm: ProviderMatch = {
      id: 55,
      stage: 'GROUP_STAGE',
      utcDate: '2026-06-15T18:00:00Z',
      status: 'FINISHED',
      homeTeam: { name: 'Brazil' },
      awayTeam: { name: 'Chile' },
      score: { fullTime: { home: 2, away: 0 } },
    };
    const m = mapToDomain(pm);
    expect(m.penaltyHome).toBeNull();
    expect(m.penaltyAway).toBeNull();
  });

  it('leaves an extra-time (non-shootout) result on fullTime', () => {
    const pm: ProviderMatch = {
      id: 53,
      stage: 'SEMI_FINALS',
      utcDate: '2026-07-08T18:00:00Z',
      status: 'FINISHED',
      homeTeam: { name: 'Spain' },
      awayTeam: { name: 'France' },
      score: { winner: 'HOME_TEAM', duration: 'EXTRA_TIME', fullTime: { home: 2, away: 1 } },
    };
    const m = mapToDomain(pm);
    expect(m.homeScore).toBe(2);
    expect(m.awayScore).toBe(1);
  });

  it('maps the live minute when the provider sends one', () => {
    const pm: ProviderMatch = {
      id: 13,
      stage: 'GROUP_STAGE',
      utcDate: '2026-06-15T18:00:00Z',
      status: 'IN_PLAY',
      minute: 37,
      homeTeam: { name: 'Brazil' },
      awayTeam: { name: 'Argentina' },
      score: { fullTime: { home: 1, away: 0 } },
    };
    const m = mapToDomain(pm);
    expect(m.status).toBe('IN_PLAY');
    expect(m.minute).toBe(37);
  });

  it('marks undetermined knockout teams as placeholder', () => {
    const pm: ProviderMatch = {
      id: 99,
      stage: 'LAST_32',
      utcDate: '2026-07-01T18:00:00Z',
      status: 'SCHEDULED',
      homeTeam: { name: null },
      awayTeam: { name: null },
    };
    const m = mapToDomain(pm);
    expect(m.placeholder).toBe(true);
    expect(m.homeTeam).toBe('TBD');
    expect(m.stage).toBe('LAST_32');
  });
});

describe('createFootballApiClient', () => {
  it('throws a clear error when the token is missing (US-7.2)', async () => {
    const client = createFootballApiClient({ ...testConfig, footballApiToken: '' }, noopLogger);
    await expect(client.fetchCompetitionMatches()).rejects.toBeInstanceOf(ConfigError);
  });

  it('fetches and maps matches', async () => {
    const fakeFetch = (async () =>
      new Response(JSON.stringify({ matches: [{ id: 1, utcDate: '2026-06-15T18:00:00Z', homeTeam: { name: 'A' }, awayTeam: { name: 'B' } }] }), {
        status: 200,
      })) as unknown as typeof fetch;
    const client = createFootballApiClient(testConfig, noopLogger, fakeFetch);
    const matches = await client.fetchCompetitionMatches();
    expect(matches).toHaveLength(1);
    expect(matches[0]?.homeTeam).toBe('A');
  });
});
