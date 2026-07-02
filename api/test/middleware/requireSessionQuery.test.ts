import { describe, it, expect, vi } from 'vitest';
import { requireSessionQuery } from '../../src/middleware/index';
import { signSession } from '../../src/lib/token';
import { testConfig } from '../support/testApp';

function run(query: Record<string, unknown>) {
  const req = { query } as never;
  const res = {} as never;
  const next = vi.fn();
  requireSessionQuery(testConfig)(req, res, next);
  return { req, next };
}

describe('requireSessionQuery', () => {
  it('sets callerId for a valid token', () => {
    const token = signSession('player-1', testConfig.sessionSigningSecret, 30);
    const { req, next } = run({ token });
    expect((req as { callerId?: string }).callerId).toBe('player-1');
    expect(next).toHaveBeenCalledWith(); // no error
  });

  it('errors for a missing token', () => {
    const { next } = run({});
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});
