// One-shot sync runner for the Kubernetes CronJob: runs a single sync then exits.
import { composeFromEnv } from './bootstrap';

const { services, logger } = composeFromEnv();

services.sync
  .sync()
  .then(async (report) => {
    logger.info('cronjob sync finished', {
      ok: report.ok,
      fetched: report.fetched,
      scored: report.scored,
      errors: report.errors,
    });
    // Ingest ESPN first-goal facts (first team / first scorer) and re-score affected matches.
    await services.espnFacts.ingest().catch((err) => {
      logger.warn('espn facts ingest failed', { error: err instanceof Error ? err.message : 'unknown' });
    });
    // Refresh the Golden Boot top-scorer tally (self-throttled to ~15 min; no-op until KO).
    await services.goldenBoot.refresh().catch((err) => {
      logger.warn('golden boot refresh failed', { error: err instanceof Error ? err.message : 'unknown' });
    });
    // Recompute Dark Horse placements from match progress (cheap; no external calls).
    await services.darkHorse.refresh().catch((err) => {
      logger.warn('dark horse refresh failed', { error: err instanceof Error ? err.message : 'unknown' });
    });
    // Score the Tournament Winner pick once the final is decided.
    await services.tournamentWinner.refresh().catch((err) => {
      logger.warn('tournament winner refresh failed', { error: err instanceof Error ? err.message : 'unknown' });
    });
    process.exit(report.ok ? 0 : 1);
  })
  .catch((err) => {
    logger.error('cronjob sync failed', { error: err instanceof Error ? err.message : 'unknown' });
    process.exit(1);
  });
