// Long-running adaptive poller (Kubernetes Deployment, replicas:1). Replaces the every-minute
// CronJob: polls ESPN every 12s while any match is live, 60s otherwise, so live scores land in
// DynamoDB within ~12s instead of up to 60s. Runs the same post-sync refreshes as sync.run.ts.
import { composeFromEnv } from './bootstrap';

export function nextPollDelayMs(matches: { status: string }[]): number {
  const live = matches.some((m) => m.status === 'IN_PLAY' || m.status === 'PAUSED');
  return live ? 12_000 : 60_000;
}

async function runForever(): Promise<void> {
  const { services, logger } = composeFromEnv();
  logger.info('live poller starting');
  let stopping = false;
  process.on('SIGTERM', () => { stopping = true; });
  process.on('SIGINT', () => { stopping = true; });

  while (!stopping) {
    try {
      const report = await services.sync.sync();
      // Same downstream refreshes the CronJob ran (best-effort, non-fatal).
      await services.espnFacts.ingest().catch((err) => logger.warn('espn facts ingest failed', { error: String(err) }));
      await services.goldenBoot.refresh().catch((err) => logger.warn('golden boot refresh failed', { error: String(err) }));
      await services.darkHorse.refresh().catch((err) => logger.warn('dark horse refresh failed', { error: String(err) }));
      await services.tournamentWinner.refresh().catch((err) => logger.warn('tournament winner refresh failed', { error: String(err) }));
      await services.notifications.sendKickoffReminders().catch((err) => logger.warn('kickoff reminders failed', { error: String(err) }));
      logger.info('live poll', { ok: report.ok, fetched: report.fetched, scored: report.scored });
    } catch (err) {
      logger.error('live poll failed', { error: err instanceof Error ? err.message : 'unknown' });
    }
    const matches = await services.matches.list().catch(() => []);
    const delay = nextPollDelayMs(matches);
    await new Promise((r) => setTimeout(r, delay));
  }
  logger.info('live poller stopped');
  process.exit(0);
}

// Only run the loop when executed directly (not when imported by the unit test).
if (process.env.VITEST !== 'true') {
  void runForever();
}
