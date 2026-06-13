import { describe, it, expect, vi, afterEach } from 'vitest';
import { createLogger } from '../../src/lib/logger';

afterEach(() => {
  vi.restoreAllMocks();
});

function captureLine(fn: () => void): Record<string, unknown> {
  const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
  fn();
  expect(spy).toHaveBeenCalledTimes(1);
  return JSON.parse(spy.mock.calls[0]![0] as string);
}

describe('logger redaction (SECURITY-03)', () => {
  it('redacts a top-level secret key', () => {
    const line = captureLine(() => createLogger().info('hi', { token: 'abc123' }));
    expect(line.token).toBe('[REDACTED]');
  });

  it('redacts a secret nested in a plain object', () => {
    const line = captureLine(() => createLogger().info('hi', { ctx: { pin: '1234' } }));
    expect((line.ctx as Record<string, unknown>).pin).toBe('[REDACTED]');
  });

  it('redacts a secret inside an object nested in an array', () => {
    const line = captureLine(() =>
      createLogger().info('hi', { items: [{ token: 'leak-me' }, { ok: 'safe' }] }),
    );
    const items = line.items as Array<Record<string, unknown>>;
    expect(items[0]!.token).toBe('[REDACTED]');
    expect(items[1]!.ok).toBe('safe'); // non-secret values preserved
    // The raw secret must never appear anywhere in the serialized line.
    expect(JSON.stringify(line)).not.toContain('leak-me');
  });

  it('redacts a secret in an object nested deeper inside arrays', () => {
    const line = captureLine(() =>
      createLogger().info('hi', { groups: [{ members: [{ password: 'hunter2' }] }] }),
    );
    expect(JSON.stringify(line)).not.toContain('hunter2');
  });
});
