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

  it('maps an AWARDED (forfeit) result to FINISHED so it gets scored', () => {
    const pm: ProviderMatch = {
      id: 77,
      stage: 'GROUP_STAGE',
      utcDate: '2026-06-20T18:00:00Z',
      status: 'AWARDED',
      homeTeam: { name: 'Brazil' },
      awayTeam: { name: 'Korea' },
      score: { winner: 'HOME_TEAM', fullTime: { home: 3, away: 0 } },
    };
    const m = mapToDomain(pm);
    expect(m.status).toBe('FINISHED');
    expect(m.homeScore).toBe(3);
    expect(m.winner).toBe('HOME');
  });

  it('maps POSTPONED/CANCELLED to their own status rather than SCHEDULED', () => {
    const base = { id: 88, stage: 'GROUP_STAGE', utcDate: '2026-06-20T18:00:00Z', homeTeam: { name: 'A' }, awayTeam: { name: 'B' } };
    expect(mapToDomain({ ...base, status: 'POSTPONED' }).status).toBe('POSTPONED');
    expect(mapToDomain({ ...base, status: 'CANCELLED' }).status).toBe('CANCELLED');
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
