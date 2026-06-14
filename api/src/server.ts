import express, { type Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import type { Config } from './lib/config';
import type { Logger } from './lib/logger';
import type { Services } from './services/container';
import { buildRouter } from './routes/index';
import {
  requestContext,
  createRateLimiters,
  notFoundHandler,
  errorHandler,
} from './middleware/index';

// Builds the Express app with the full security middleware pipeline (no network binding).
export function buildApp(services: Services, config: Config, logger: Logger): Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  const limiters = createRateLimiters();

  app.use(helmet()); // SECURITY-04
  app.use(cors({ origin: config.allowedOrigin })); // SECURITY-08 (strict allowlist)
  app.use(requestContext(logger)); // SECURITY-03 (sets req.log; must precede limiter)

  // Health/probe endpoint is registered before the global limiter so probes are never
  // rate-limited and never consume the global bucket.
  app.get('/health', (_req, res) => res.json({ ok: true }));

  // Global limiter runs before body parsing so rejected requests aren't parsed first.
  app.use(limiters.global); // SECURITY-11
  app.use(express.json({ limit: '16kb' })); // SECURITY-05 (body size limit)

  app.use('/api', buildRouter(services, config, limiters));

  app.use(notFoundHandler());
  app.use(errorHandler()); // SECURITY-09/15

  return app;
}
