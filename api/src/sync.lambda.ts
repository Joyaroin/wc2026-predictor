// Scheduled (EventBridge) / manual sync entry point: pulls fixtures+results and rescoring.
import { composeFromEnv } from './bootstrap';

export const handler = async (): Promise<{ ok: boolean; fetched: number; scored: number }> => {
  const { services, logger } = composeFromEnv();
  const report = await services.sync.sync();
  logger.info('scheduled sync finished', { ok: report.ok, fetched: report.fetched, scored: report.scored });
  return { ok: report.ok, fetched: report.fetched, scored: report.scored };
};
