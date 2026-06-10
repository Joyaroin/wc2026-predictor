import { describe, it, expect } from 'vitest';
import { createGoldenBootService } from '../../src/services/goldenBoot';
import { createMatchService } from '../../src/services/matches';
import { createMemoryRepositories } from '../../src/repos/memory';
import { extractGoals, tallyTopScorers, type EspnClient } from '../../src/integration/espnClient';
import type { Logger } from '../../src/lib/logger';
import { sampleMatch } from '../support/testApp';

const noopLogger = { info() {}, warn() {}, error() {}, debug() {} } as unknown as Logger;
const fixedClock = (iso: string) => ({ now: () => new Date(iso) });

describe('espn goal parsing', () => {
  it('extractGoals picks goals (incl. penalties), ignores cards/disallowed', () => {
    const summary = {
      keyEvents: [
        { type: { text: 'Goal' }, athletesInvolved: [{ id: 7, displayName: 'Ronaldo' }] },
        { type: { text: 'Goal - Penalty' }, athletesInvolved: [{ id: 7, displayName: 'Ronaldo' }] },
        { type: { text: 'Goal disallowed' }, athletesInvolved: [{ id: 7, displayName: 'Ronaldo' }] },
        { type: { text: 'Yellow Card' }, athletesInvolved: [{ id: 5, displayName: 'Pepe' }] },
      ],
    };
    const goals = extractGoals(summary);
    expect(goals).toHaveLength(2);
    const tally = tallyTopScorers([{ eventId: 'e', date: '', goals }]);
    expect(tally[0]).toMatchObject({ scorerId: '7', scorerName: 'Ronaldo', goals: 2 });
  });
});

describe('golden boot refresh', () => {
  it('sets the leader and awards the bonus to matching picks', async () => {
    const repos = createMemoryRepositories();
    const now = '2026-06-20T00:00:00.000Z';
    await repos.matches.upsert(sampleMatch({ id: 'm1', kickoff: '2026-06-11T16:00:00.000Z' }));
    await repos.goldenBoot.put({ playerId: 'sam', scorerId: '7', scorerName: 'Ronaldo', points: 0, createdAt: now, updatedAt: now });
    await repos.goldenBoot.put({ playerId: 'mia', scorerId: '9', scorerName: 'Kane', points: 0, createdAt: now, updatedAt: now });

    const fakeEspn: EspnClient = {
      async fetchPlayerPool() {
        return [];
      },
      async fetchFinishedEventGoals() {
        return [
          {
            eventId: 'e1',
            date: now,
            goals: [
              { scorerId: '7', scorerName: 'Ronaldo' },
              { scorerId: '7', scorerName: 'Ronaldo' },
              { scorerId: '9', scorerName: 'Kane' },
            ],
          },
        ];
      },
    };

    const svc = createGoldenBootService(
      repos.goldenBoot,
      repos.stats,
      createMatchService(repos.matches, fixedClock(now)),
      fakeEspn,
      fixedClock(now),
      noopLogger,
    );
    await svc.refresh();

    expect((await repos.stats.getLeader())?.scorerName).toBe('Ronaldo'); // 2 goals leads
    expect((await repos.goldenBoot.get('sam'))?.points).toBe(15); // picked the leader
    expect((await repos.goldenBoot.get('mia'))?.points).toBe(0);
  });
});
