// Local development entry point: runs the Express app on a port.
import { composeFromEnv } from './bootstrap';

const { app, services, logger } = composeFromEnv();
const port = Number(process.env.PORT ?? '4000');

app.listen(port, () => {
  logger.info('api listening', { port });
  // Dev convenience: populate fixtures on startup (needed in in-memory mode, where the
  // scheduled sync Lambda would otherwise run in a separate process).
  if (process.env.SYNC_ON_START === 'true') {
    services.sync
      .sync()
      .then((r) => logger.info('startup sync', { ok: r.ok, fetched: r.fetched, scored: r.scored, errors: r.errors }))
      .catch((err) => logger.error('startup sync failed', { error: err instanceof Error ? err.message : 'unknown' }));
  }
});
