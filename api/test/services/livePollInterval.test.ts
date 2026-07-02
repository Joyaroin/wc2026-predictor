import { describe, it, expect } from 'vitest';
import { nextPollDelayMs } from '../../src/sync.live';

describe('nextPollDelayMs', () => {
  it('is 12s when a match is live', () => {
    expect(nextPollDelayMs([{ status: 'SCHEDULED' }, { status: 'IN_PLAY' }])).toBe(12_000);
    expect(nextPollDelayMs([{ status: 'PAUSED' }])).toBe(12_000);
  });
  it('is 60s when nothing is live', () => {
    expect(nextPollDelayMs([{ status: 'SCHEDULED' }, { status: 'FINISHED' }])).toBe(60_000);
    expect(nextPollDelayMs([])).toBe(60_000);
  });
});
