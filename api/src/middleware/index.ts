// Cross-cutting middleware (security pipeline). See nfr-design-patterns.md for ordering.
import type { Request, Response, NextFunction, RequestHandler, ErrorRequestHandler } from 'express';
import { randomUUID } from 'node:crypto';
import rateLimit from 'express-rate-limit';
import type { ZodSchema } from 'zod';
import type { Config } from '../lib/config';
import type { Logger } from '../lib/logger';
import { AppError, AuthError, ValidationError } from '../lib/errors';
import { verifySession } from '../lib/token';

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

export const globalLimiter = rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: true, legacyHeaders: false });
export const loginLimiter = rateLimit({ windowMs: 60_000, limit: 10, standardHeaders: true, legacyHeaders: false });
export const joinLimiter = rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: true, legacyHeaders: false });
export const assistantLimiter = rateLimit({ windowMs: 60_000, limit: 12, standardHeaders: true, legacyHeaders: false });
export const messagesLimiter = rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: true, legacyHeaders: false });

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
