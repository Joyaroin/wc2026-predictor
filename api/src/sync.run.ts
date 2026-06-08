// One-shot sync runner for the Kubernetes CronJob: runs a single sync then exits.
import { composeFromEnv } from './bootstrap';

const { services, logger } = composeFromEnv();

services.sync
  .sync()
  .then((report) => {
    logger.info('cronjob sync finished', {
      ok: report.ok,
      fetched: report.fetched,
      scored: report.scored,
      errors: report.errors,
    });
    process.exit(report.ok ? 0 : 1);
  })
  .catch((err) => {
    logger.error('cronjob sync failed', { error: err instanceof Error ? err.message : 'unknown' });
    process.exit(1);
  });
