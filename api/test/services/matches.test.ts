import { describe, it, expect } from 'vitest';
import { createMemoryRepositories } from '../../src/repos/memory';
import { createMatchService } from '../../src/services/matches';
import { fixedClock } from '../../src/lib/clock';
import { sampleMatch } from '../support/testApp';

describe('matchService.isLocked', () => {
  it('locks once now is at/after a valid kickoff and stays open before it', () => {
    const repos = createMemoryRepositories();
    const before = createMatchService(repos.matches, fixedClock(new Date('2026-06-15T10:00:00.000Z')));
    const after = createMatchService(repos.matches, fixedClock(new Date('2026-06-15T19:00:00.000Z')));
    const match = sampleMatch({ kickoff: '2026-06-15T18:00:00.000Z' });
    expect(before.isLocked(match)).toBe(false);
    expect(after.isLocked(match)).toBe(true);
  });

  it('fails CLOSED for a malformed kickoff (NaN compare must not leave it open forever)', () => {
    const repos = createMemoryRepositories();
    // A far-future "now" would normally keep a future match open; here the kickoff is unparseable.
    const svc = createMatchService(repos.matches, fixedClock(new Date('2000-01-01T00:00:00.000Z')));
    expect(svc.isLocked(sampleMatch({ kickoff: 'not-a-date' }))).toBe(true);
    expect(svc.isLocked(sampleMatch({ kickoff: '' }))).toBe(true);
  });
});
