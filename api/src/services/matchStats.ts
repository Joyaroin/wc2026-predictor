// On-demand rich match stats (box score + lineups) from ESPN, fetched only when a card is expanded.
// Cached briefly so several viewers of the same match don't each trigger ESPN calls.
import type { EspnClient, MatchStats } from '../integration/espnClient';
import type { MatchRepo } from '../repos/types';
import type { Clock } from '../lib/clock';
import type { Logger } from '../lib/logger';

export interface MatchStatsService {
  get(matchId: string): Promise<MatchStats | null>;
}

/** YYYYMMDD (UTC) for an ISO timestamp, offset by `deltaDays`. */
function dateKey(iso: string, deltaDays: number): string {
  const d = new Date(iso);
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
}

const LIVE_TTL_MS = 20_000;
const STATIC_TTL_MS = 5 * 60_000;

export function createMatchStatsService(
  espn: EspnClient,
  matches: MatchRepo,
  clock: Clock,
  logger: Logger,
): MatchStatsService {
  const cache = new Map<string, { at: number; data: MatchStats | null }>();

  return {
    async get(matchId) {
      const match = await matches.getById(matchId);
      if (!match || match.placeholder) return null;

      const live = match.status === 'IN_PLAY' || match.status === 'PAUSED';
      const ttl = live ? LIVE_TTL_MS : STATIC_TTL_MS;
      const now = clock.now().getTime();
      const hit = cache.get(matchId);
      if (hit && now - hit.at < ttl) return hit.data;

      // ESPN can file a late kickoff under the next UTC day — try a small window.
      const dates = [dateKey(match.kickoff, 0), dateKey(match.kickoff, 1), dateKey(match.kickoff, -1)];
      let data: MatchStats | null = null;
      try {
        data = await espn.fetchMatchStats(dates, match.homeTeam, match.awayTeam);
      } catch (err) {
        logger.warn('match stats fetch failed', { matchId, error: err instanceof Error ? err.message : 'unknown' });
      }
      cache.set(matchId, { at: now, data });
      return data;
    },
  };
}
