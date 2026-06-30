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
  score?: {
    winner?: string | null;
    /** REGULAR | EXTRA_TIME | PENALTY_SHOOTOUT — how the match was decided. */
    duration?: string | null;
    /** Running/final score. NOTE: for a PENALTY_SHOOTOUT this INCLUDES the shootout goals. */
    fullTime?: { home: number | null; away: number | null };
    /** Score after 90 minutes (present for extra-time / shootout matches). */
    regularTime?: { home: number | null; away: number | null };
    /** Goals scored in extra time only. */
    extraTime?: { home: number | null; away: number | null };
    /** Penalty-shootout goals only. */
    penalties?: { home: number | null; away: number | null };
  };
}

type Side = 'home' | 'away';

/**
 * The result that counts for predictions. For a penalty shootout, football-data.org folds the
 * shootout into `fullTime`, so we use the end-of-normal/extra-time score instead (a draw) — the
 * shootout winner is carried separately on `score.winner`. Every other match uses `fullTime`.
 * See https://docs.football-data.org/general/v4/overtime.html
 */
function resultScore(s: ProviderMatch['score'], side: Side): number | null {
  if (!s) return null;
  if (s.duration === 'PENALTY_SHOOTOUT') {
    if (s.regularTime?.[side] != null) return (s.regularTime[side] ?? 0) + (s.extraTime?.[side] ?? 0);
    // Fallback if the breakdown is missing: strip the shootout off the cumulative total.
    if (s.fullTime?.[side] != null && s.penalties?.[side] != null) return (s.fullTime[side] ?? 0) - (s.penalties[side] ?? 0);
  }
  return s.fullTime?.[side] ?? null;
}

const WINNER: Record<string, 'HOME' | 'AWAY' | 'DRAW'> = {
  HOME_TEAM: 'HOME',
  AWAY_TEAM: 'AWAY',
  DRAW: 'DRAW',
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
    homeScore: resultScore(pm.score, 'home'),
    awayScore: resultScore(pm.score, 'away'),
    winner: (pm.score?.winner && WINNER[pm.score.winner]) || null,
    penaltyHome: pm.score?.duration === 'PENALTY_SHOOTOUT' ? (pm.score.penalties?.home ?? null) : null,
    penaltyAway: pm.score?.duration === 'PENALTY_SHOOTOUT' ? (pm.score.penalties?.away ?? null) : null,
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
