// football-data.org integration (SR-1/SR-3). Pure `mapToDomain` is exported for tests.
import type { Match, Stage, MatchStatus } from '@wc2026/shared';
import type { Config } from '../lib/config';
import type { Logger } from '../lib/logger';
import { ConfigError } from '../lib/config';

export interface ProviderTeam {
  name: string | null;
  tla?: string | null;
}
export interface ProviderMatch {
  id: number | string;
  stage?: string;
  group?: string | null;
  matchday?: number | null;
  utcDate: string;
  status?: string;
  homeTeam?: ProviderTeam;
  awayTeam?: ProviderTeam;
  score?: { fullTime?: { home: number | null; away: number | null } };
}

const STAGES: Record<string, Stage> = {
  GROUP_STAGE: 'GROUP_STAGE',
  LAST_32: 'LAST_32',
  LAST_16: 'LAST_16',
  QUARTER_FINALS: 'QUARTER_FINALS',
  SEMI_FINALS: 'SEMI_FINALS',
  THIRD_PLACE: 'THIRD_PLACE',
  FINAL: 'FINAL',
};
const STATUSES: Record<string, MatchStatus> = {
  SCHEDULED: 'SCHEDULED',
  TIMED: 'TIMED',
  IN_PLAY: 'IN_PLAY',
  PAUSED: 'PAUSED',
  FINISHED: 'FINISHED',
};

export function mapToDomain(pm: ProviderMatch): Match {
  const homeName = pm.homeTeam?.name ?? null;
  const awayName = pm.awayTeam?.name ?? null;
  const placeholder = homeName === null || awayName === null;
  const groupName = pm.group && pm.group.startsWith('GROUP_') ? pm.group.slice('GROUP_'.length) : null;
  return {
    id: String(pm.id),
    stage: (pm.stage && STAGES[pm.stage]) || 'GROUP_STAGE',
    groupName,
    matchday: pm.matchday ?? null,
    homeTeam: homeName ?? 'TBD',
    homeCode: pm.homeTeam?.tla ?? null,
    awayTeam: awayName ?? 'TBD',
    awayCode: pm.awayTeam?.tla ?? null,
    kickoff: pm.utcDate,
    status: (pm.status && STATUSES[pm.status]) || 'SCHEDULED',
    homeScore: pm.score?.fullTime?.home ?? null,
    awayScore: pm.score?.fullTime?.away ?? null,
    placeholder,
  };
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export interface FootballApiClient {
  fetchCompetitionMatches(): Promise<Match[]>;
}

export function createFootballApiClient(
  config: Config,
  logger: Logger,
  fetchImpl: typeof fetch = fetch,
): FootballApiClient {
  const base = 'https://api.football-data.org/v4';

  async function fetchWithRetry(url: string, attempts = 3): Promise<Response> {
    let lastErr: unknown;
    for (let i = 0; i < attempts; i++) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000);
      try {
        const res = await fetchImpl(url, {
          headers: { 'X-Auth-Token': config.footballApiToken },
          signal: ctrl.signal,
        });
        if (res.status === 429 || res.status >= 500) {
          throw new Error(`Provider responded ${res.status}`);
        }
        return res;
      } catch (err) {
        lastErr = err;
        const backoff = 250 * 2 ** i + Math.floor(Math.random() * 100);
        logger.warn('football api retry', { attempt: i + 1, backoff });
        await sleep(backoff);
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error('Provider request failed');
  }

  return {
    async fetchCompetitionMatches() {
      if (!config.footballApiToken) {
        // Clear, actionable error (US-7.2). Never logs the (missing) token.
        throw new ConfigError('FOOTBALL_DATA_TOKEN is not configured; cannot sync fixtures/results.');
      }
      const res = await fetchWithRetry(`${base}/competitions/${config.competition}/matches`);
      if (!res.ok) throw new Error(`Provider error ${res.status}`);
      const body = (await res.json()) as { matches?: ProviderMatch[] };
      return (body.matches ?? []).map(mapToDomain);
    },
  };
}
