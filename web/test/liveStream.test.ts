import { describe, it, expect } from 'vitest';
import { nextBackoffMs } from '../src/lib/liveStream';

// Pure backoff schedule: doubles each attempt, capped at 30s, so a dead token/stream
// doesn't hammer the server or spin forever once we give up (attempt >= 6 in the caller).
describe('nextBackoffMs', () => {
  it('starts at 1000ms for the first attempt', () => {
    expect(nextBackoffMs(0)).toBe(1000);
  });
  it('doubles with each attempt', () => {
    expect(nextBackoffMs(1)).toBe(2000);
    expect(nextBackoffMs(2)).toBe(4000);
    expect(nextBackoffMs(3)).toBe(8000);
    expect(nextBackoffMs(4)).toBe(16000);
  });
  it('caps at 30000ms for large attempt counts', () => {
    expect(nextBackoffMs(5)).toBe(30000);
    expect(nextBackoffMs(6)).toBe(30000);
    expect(nextBackoffMs(20)).toBe(30000);
  });
});
