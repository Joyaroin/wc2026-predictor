import { describe, it, expect } from 'vitest';
import { isHealthy } from '../../src/sync.live';

describe('isHealthy', () => {
  it('is healthy when the last successful iteration is within the stale window', () => {
    expect(isHealthy(1_000, 1_000, 90_000)).toBe(true);
    expect(isHealthy(1_000, 90_999, 90_000)).toBe(true);
  });
  it('is unhealthy at or after the stale boundary', () => {
    expect(isHealthy(1_000, 91_000, 90_000)).toBe(false);
    expect(isHealthy(1_000, 100_000, 90_000)).toBe(false);
  });
});
