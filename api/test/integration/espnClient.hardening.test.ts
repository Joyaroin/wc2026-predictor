import { describe, it, expect, vi } from 'vitest';
import { createEspnClient } from '../../src/integration/espnClient';
import type { Logger } from '../../src/lib/logger';

const noopLogger = { info() {}, warn() {}, error() {}, debug() {} } as unknown as Logger;

const BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world';

function response(status: number, body: unknown = {}, headers: Record<string, string> = {}): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (k: string) => headers[k.toLowerCase()] ?? null },
    json: async () => body,
  } as unknown as Response;
}

describe('espnClient hardening', () => {
  it('passes an abort signal so a hung ESPN request times out', async () => {
    let seenSignal: AbortSignal | null | undefined;
    const fetchImpl = vi.fn(async (_url: string | URL, init?: RequestInit) => {
      seenSignal = init?.signal;
      return response(200, { events: [] });
    });
    const client = createEspnClient(noopLogger, fetchImpl as unknown as typeof fetch);
    await client.fetchMatchFirstGoals(['20260703']);
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(seenSignal).toBeInstanceOf(AbortSignal);
  });

  it('stops calling ESPN during the cooldown after a 429', async () => {
    const fetchImpl = vi.fn(async () => response(429));
    const client = createEspnClient(noopLogger, fetchImpl as unknown as typeof fetch);

    // First call hits ESPN, gets refused, and opens the cooldown.
    await expect(client.fetchMatchStats(['20260703'], 'Brazil', 'France')).resolves.toBeNull();
    const callsAfterRefusal = fetchImpl.mock.calls.length;

    // Subsequent calls fail fast without another request to ESPN.
    await expect(client.fetchMatchStats(['20260703'], 'Brazil', 'France')).resolves.toBeNull();
    await client.fetchMatchFirstGoals(['20260703']);
    expect(fetchImpl.mock.calls.length).toBe(callsAfterRefusal);
  });

  it('honours Retry-After when ESPN provides one', async () => {
    vi.useFakeTimers();
    try {
      const responses = [response(429, {}, { 'retry-after': '2' }), response(200, { events: [] })];
      const fetchImpl = vi.fn(async () => responses.shift() ?? response(200, { events: [] }));
      const client = createEspnClient(noopLogger, fetchImpl as unknown as typeof fetch);

      await client.fetchMatchFirstGoals(['20260703']);
      expect(fetchImpl).toHaveBeenCalledTimes(1);

      // Still inside the 2s window: no new request.
      vi.advanceTimersByTime(1_000);
      await client.fetchMatchFirstGoals(['20260703']);
      expect(fetchImpl).toHaveBeenCalledTimes(1);

      // Past the window: requests resume.
      vi.advanceTimersByTime(1_500);
      await client.fetchMatchFirstGoals(['20260703']);
      expect(fetchImpl).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('cools down on 403 (ESPN IP block) too', async () => {
    const fetchImpl = vi.fn(async () => response(403));
    const client = createEspnClient(noopLogger, fetchImpl as unknown as typeof fetch);
    await client.fetchMatchFirstGoals(['20260703']);
    await client.fetchMatchFirstGoals(['20260703']);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it(`does not cool down on ordinary errors (e.g. 500) — the next call still tries ${BASE}`, async () => {
    const fetchImpl = vi.fn(async () => response(500));
    const client = createEspnClient(noopLogger, fetchImpl as unknown as typeof fetch);
    await client.fetchMatchFirstGoals(['20260703']);
    await client.fetchMatchFirstGoals(['20260703']);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
