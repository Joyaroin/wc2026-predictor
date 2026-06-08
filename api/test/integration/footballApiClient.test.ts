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
      homeScore: 2,
      awayScore: 1,
      placeholder: false,
    });
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
