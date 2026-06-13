// Cross-cutting middleware (security pipeline). See nfr-design-patterns.md for ordering.
import type { Request, Response, NextFunction, RequestHandler, ErrorRequestHandler } from 'express';
import { randomUUID } from 'node:crypto';
import rateLimit from 'express-rate-limit';
import type { ZodSchema } from 'zod';
import type { Config } from '../lib/config';
import type { Logger } from '../lib/logger';
import { AppError, AuthError, ForbiddenError, ValidationError } from '../lib/errors';
import { verifySession } from '../lib/token';
import { secureEquals } from '../lib/secureCompare';

// Augment Express request with our fields.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      requestId: string;
      log: Logger;
      callerId?: string;
    }
  }
}

export function requestContext(logger: Logger): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    req.requestId = randomUUID();
    req.log = logger.child({ requestId: req.requestId, method: req.method, path: req.path });
    next();
  };
}

export function requireSession(config: Config): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const header = req.header('authorization') ?? '';
    const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';
    const callerId = token ? verifySession(token, config.sessionSigningSecret) : null;
    if (!callerId) {
      next(new AuthError());
      return;
    }
    req.callerId = callerId;
    next();
  };
}

/**
 * Gates /admin/* routes on a valid X-Admin-Token, in constant time (SECURITY-12).
 * Applied BEFORE validateBody so unauthorized requests are rejected before any body parsing/
 * schema validation work — and before the strict admin rate limiter is consumed by attackers'
 * malformed bodies. Service-layer token checks remain as defense in depth.
 */
export function requireAdminToken(config: Config): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const token = req.header('x-admin-token') ?? '';
    if (!secureEquals(token, config.adminToken)) {
      next(new ForbiddenError('Admin token required'));
      return;
    }
    next();
  };
}

/** Validates and replaces req.body using a zod schema (SECURITY-05). */
export function validateBody<T>(schema: ZodSchema<T>): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      next(new ValidationError(parsed.error.message));
      return;
    }
    req.body = parsed.data;
    next();
  };
}

export interface RateLimiters {
  global: RequestHandler;
  login: RequestHandler;
  join: RequestHandler;
  admin: RequestHandler;
}

/**
 * Build the per-app rate limiters. Created once per `buildApp` call rather than as module
 * singletons: production builds the app a single time (so the in-memory counters persist for the
 * process lifetime, exactly as before), while each test app gets its own fresh, isolated store.
 * The strict `admin` cap guards privileged actions so a stolen/guessed token cannot be used for
 * high-rate abuse (SECURITY-11).
 */
export function createRateLimiters(): RateLimiters {
  return {
    global: rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: true, legacyHeaders: false }),
    login: rateLimit({ windowMs: 60_000, limit: 10, standardHeaders: true, legacyHeaders: false }),
    join: rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: true, legacyHeaders: false }),
    admin: rateLimit({ windowMs: 60_000, limit: 10, standardHeaders: true, legacyHeaders: false }),
  };
}

export function notFoundHandler(): RequestHandler {
  return (_req, res) => {
    res.status(404).json({ error: 'Not found' });
  };
}

export function errorHandler(): ErrorRequestHandler {
  return (err: unknown, req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof AppError) {
      if (err.status >= 500) req.log?.error('request error', { error: err.message });
      else req.log?.warn('request rejected', { status: err.status, code: err.publicMessage });
      res.status(err.status).json({ error: err.publicMessage });
      return;
    }
    // Body-parser errors (malformed JSON, oversized payload) are client errors, not 500s.
    const e = err as { type?: string; status?: number } | null;
    if (e && (e.type === 'entity.parse.failed' || e.type === 'entity.too.large' || (typeof e.status === 'number' && e.status >= 400 && e.status < 500))) {
      req.log?.warn('request rejected', { status: e.status ?? 400, code: 'bad request body' });
      res.status(e.status ?? 400).json({ error: e.type === 'entity.too.large' ? 'Request body too large' : 'Malformed request body' });
      return;
    }
    req.log?.error('unhandled error', { error: err instanceof Error ? err.message : 'unknown' });
    res.status(500).json({ error: 'Internal error' });
  };
}
