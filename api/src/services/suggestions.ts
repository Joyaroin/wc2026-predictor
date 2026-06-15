// On-demand statistical scoreline suggestions from bookmaker odds (ESPN), opt-in only.
// Cached briefly so several viewers / a "fill my blanks" pass don't re-hit ESPN per match.
import { suggestFromOdds, type ScoreSuggestion } from '@wc2026/shared';
import type { EspnClient } from '../integration/espnClient';
import type { MatchRepo } from '../repos/types';
import type { Clock } from '../lib/clock';
import type { Logger } from '../lib/logger';

export interface SuggestionsService {
  getForMatches(ids: string[]): Promise<Record<string, ScoreSuggestion | null>>;
}

const TTL_MS = 30 * 60_000; // odds move slowly

/** YYYYMMDD (UTC) for an ISO timestamp, offset by `deltaDays`. */
function dateKey(iso: string, deltaDays: number): string {
  const d = new Date(iso);
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
}

export function createSuggestionsService(
  espn: EspnClient,
  matches: MatchRepo,
  clock: Clock,
  logger: Logger,
): SuggestionsService {
  const cache = new Map<string, { at: number; data: ScoreSuggestion | null }>();

  async function one(id: string): Promise<ScoreSuggestion | null> {
    const match = await matches.getById(id);
    if (!match || match.placeholder || match.status === 'FINISHED') return null;
    const now = clock.now().getTime();
    const hit = cache.get(id);
    if (hit && now - hit.at < TTL_MS) return hit.data;

    const dates = [dateKey(match.kickoff, 0), dateKey(match.kickoff, 1), dateKey(match.kickoff, -1)];
    let data: ScoreSuggestion | null = null;
    try {
      const odds = await espn.fetchMatchOdds(dates, match.homeTeam, match.awayTeam);
      data = odds ? suggestFromOdds(odds) : null;
    } catch (err) {
      logger.warn('odds suggestion failed', { matchId: id, error: err instanceof Error ? err.message : 'unknown' });
    }
    cache.set(id, { at: now, data });
    return data;
  }

  return {
    async getForMatches(ids) {
      const unique = [...new Set(ids)].slice(0, 30); // bound work per request
      const results = await Promise.all(unique.map(async (id) => [id, await one(id)] as const));
      return Object.fromEntries(results);
    },
  };
}
