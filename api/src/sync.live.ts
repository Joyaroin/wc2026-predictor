// Long-running adaptive poller (Kubernetes Deployment, replicas:1). Replaces the every-minute
// CronJob: polls ESPN every 12s while any match is live, 60s otherwise, so live scores land in
// DynamoDB within ~12s instead of up to 60s. Runs the same post-sync refreshes as sync.run.ts.
import * as http from 'http';
import { composeFromEnv } from './bootstrap';

export function nextPollDelayMs(matches: { status: string }[]): number {
  const live = matches.some((m) => m.status === 'IN_PLAY' || m.status === 'PAUSED');
  return live ? 12_000 : 60_000;
}

// Max poll delay is 60s (see nextPollDelayMs); STALE_MS exceeds that with margin so a
// slow-but-alive loop isn't mistaken for a hang.
const STALE_MS = 90_000;

// Pure so it's trivially unit-testable without spinning up an HTTP server or timers.
export function isHealthy(lastOkAt: number, now: number, staleMs: number): boolean {
  return now - lastOkAt < staleMs;
}

async function runForever(): Promise<void> {
  const { services, logger } = composeFromEnv();
  logger.info('live poller starting');
  let stopping = false;
  let wake: (() => void) | null = null;
  const requestStop = () => {
    stopping = true;
    if (wake) wake();
  };
  process.on('SIGTERM', requestStop);
  process.on('SIGINT', requestStop);

  let lastOkAt = Date.now();
  const healthServer = http.createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/healthz') {
      if (isHealthy(lastOkAt, Date.now(), STALE_MS)) {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('ok');
      } else {
        res.writeHead(503, { 'Content-Type': 'text/plain' });
        res.end('stale');
      }
      return;
    }
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('not found');
  });
  const healthPort = Number(process.env.HEALTH_PORT ?? 8080);
  healthServer.listen(healthPort, () => {
    logger.info('live poller health server listening', { port: healthPort });
  });

  while (!stopping) {
    try {
      const report = await services.sync.sync();
      // Same downstream refreshes the CronJob ran (best-effort, non-fatal).
      await services.espnFacts.ingest().catch((err) => logger.warn('espn facts ingest failed', { error: err instanceof Error ? err.message : 'unknown' }));
      await services.goldenBoot.refresh().catch((err) => logger.warn('golden boot refresh failed', { error: err instanceof Error ? err.message : 'unknown' }));
      await services.darkHorse.refresh().catch((err) => logger.warn('dark horse refresh failed', { error: err instanceof Error ? err.message : 'unknown' }));
      await services.tournamentWinner.refresh().catch((err) => logger.warn('tournament winner refresh failed', { error: err instanceof Error ? err.message : 'unknown' }));
      await services.notifications.sendKickoffReminders().catch((err) => logger.warn('kickoff reminders failed', { error: err instanceof Error ? err.message : 'unknown' }));
      logger.info('live poll', { ok: report.ok, fetched: report.fetched, scored: report.scored });
      lastOkAt = Date.now();
    } catch (err) {
      logger.error('live poll failed', { error: err instanceof Error ? err.message : 'unknown' });
    }
    if (stopping) break; // signal arrived during sync/refresh work: exit now, don't arm another sleep
    const matches = await services.matches.list().catch(() => []);
    const delay = nextPollDelayMs(matches);
    await new Promise<void>((resolve) => {
      wake = resolve;
      const t = setTimeout(resolve, delay);
      if (typeof t === 'object' && t) t.unref?.();
    });
    wake = null;
  }
  await new Promise<void>((resolve) => healthServer.close(() => resolve()));
  logger.info('live poller stopped');
  process.exit(0);
}

// Only run the loop when executed directly (not when imported by the unit test).
if (process.env.VITEST !== 'true') {
  void runForever();
}
