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

function resultChanged(prev: Match | null, next: Match): boolean {
  if (next.status !== 'FINISHED' || next.homeScore === null || next.awayScore === null) return false;
  if (!prev) return true;
  return prev.status !== 'FINISHED' || prev.homeScore !== next.homeScore || prev.awayScore !== next.awayScore;
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
          await matches.upsert(next);
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
