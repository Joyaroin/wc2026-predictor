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
  minute?: number | null;
  homeTeam?: ProviderTeam;
  awayTeam?: ProviderTeam;
  score?: { winner?: string | null; fullTime?: { home: number | null; away: number | null } };
}

// `winner` is semantically HOME|AWAY only (who advanced/won). A provider DRAW carries no winner,
// so it maps to null (omitted) to stay valid against matchSchema.winner (HOME|AWAY).
const WINNER: Record<string, 'HOME' | 'AWAY'> = {
  HOME_TEAM: 'HOME',
  AWAY_TEAM: 'AWAY',
};

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
  // AWARDED = result decided administratively (e.g. forfeit); a full-time score exists, so it
  // must be treated as FINISHED to get scored (otherwise it silently fell through to SCHEDULED).
  AWARDED: 'FINISHED',
  POSTPONED: 'POSTPONED',
  SUSPENDED: 'SUSPENDED',
  CANCELLED: 'CANCELLED',
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
    minute: typeof pm.minute === 'number' ? pm.minute : null,
    homeScore: pm.score?.fullTime?.home ?? null,
    awayScore: pm.score?.fullTime?.away ?? null,
    winner: (pm.score?.winner && WINNER[pm.score.winner]) || null,
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

  const TIMEOUT_MS = 8000;

  async function fetchWithRetry(url: string, attempts = 3): Promise<Response> {
    let lastErr: unknown;
    for (let i = 0; i < attempts; i++) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
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
        // Replace the opaque AbortError ('The operation was aborted') with a clear timeout message.
        lastErr =
          err instanceof Error && err.name === 'AbortError'
            ? new Error(`football-data request timed out after ${TIMEOUT_MS}ms`)
            : err;
        // Don't sleep after the final attempt — we're about to throw, so the wait is wasted latency.
        if (i < attempts - 1) {
          const backoff = 250 * 2 ** i + Math.floor(Math.random() * 100);
          logger.warn('football api retry', { attempt: i + 1, backoff });
          await sleep(backoff);
        }
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
