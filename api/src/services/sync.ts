// Sync service: ingest fixtures/results and trigger rescoring; resilient to provider failure (SR-5).
import type { Match } from '@wc2026/shared';
import type { Logger } from '../lib/logger';
import type { MatchRepo } from '../repos/types';
import type { FootballApiClient } from '../integration/footballApiClient';
import type { ScoringService } from './scoring';

export interface SyncReport {
  ok: boolean;
  fetched: number;
  upserted: number;
  scored: number;
  errors: string[];
}

const SCORABLE: ReadonlySet<Match['status']> = new Set(['IN_PLAY', 'PAUSED', 'FINISHED']);

// Rescore on live score changes too, so prediction points and leaderboards move during a match
// (scoreMatch is idempotent — the final pass at FINISHED settles the points).
function resultChanged(prev: Match | null, next: Match): boolean {
  if (!SCORABLE.has(next.status) || next.homeScore === null || next.awayScore === null) return false;
  if (!prev) return true;
  return prev.status !== next.status || prev.homeScore !== next.homeScore || prev.awayScore !== next.awayScore;
}

export interface SyncService {
  sync(): Promise<SyncReport>;
}

export function createSyncService(
  footballApi: FootballApiClient,
  matches: MatchRepo,
  scoring: ScoringService,
  logger: Logger,
): SyncService {
  return {
    async sync() {
      const report: SyncReport = { ok: true, fetched: 0, upserted: 0, scored: 0, errors: [] };
      let fetched: Match[];
      try {
        fetched = await footballApi.fetchCompetitionMatches();
      } catch (err) {
        // Fail-soft: keep last-known data, log, report (NFR-5.1 / SECURITY-15).
        const message = err instanceof Error ? err.message : 'unknown sync error';
        logger.error('sync failed to fetch', { error: message });
        return { ...report, ok: false, errors: [message] };
      }

      report.fetched = fetched.length;
      for (const next of fetched) {
        try {
          const prev = await matches.getById(next.id);
          // Stamp the real kickoff only when we witness SCHEDULED→live. If a match is discovered
          // already live (e.g. right after a restart), leave it null → the clock falls back to the
          // scheduled kickoff instead of resetting to ~1'.
          const nowLive = next.status === 'IN_PLAY' || next.status === 'PAUSED';
          const wasLive = !!prev && (prev.status === 'IN_PLAY' || prev.status === 'PAUSED');
          const startedAt = prev?.startedAt ?? (nowLive && !wasLive ? new Date().toISOString() : null);
          // football-data doesn't carry these — preserve what ESPN ingest set so we don't wipe them each cycle.
          await matches.upsert({
            ...next,
            startedAt,
            minute: next.minute ?? prev?.minute ?? null,
            firstGoalTeam: next.firstGoalTeam ?? prev?.firstGoalTeam ?? null,
            firstScorerId: next.firstScorerId ?? prev?.firstScorerId ?? null,
            firstScorerName: next.firstScorerName ?? prev?.firstScorerName ?? null,
          });
          report.upserted++;
          if (resultChanged(prev, next)) {
            report.scored += await scoring.scoreMatch(next.id);
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : 'unknown';
          report.errors.push(`${next.id}: ${message}`);
          report.ok = false;
          logger.error('sync match failed', { matchId: next.id, error: message });
        }
      }
      logger.info('sync complete', { ...report });
      return report;
    },
  };
}
