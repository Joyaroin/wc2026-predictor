import { describe, it, expect } from 'vitest';
import { createGoldenBootService } from '../../src/services/goldenBoot';
import { createMatchService } from '../../src/services/matches';
import { createMemoryRepositories } from '../../src/repos/memory';
import { createEspnClient, goalsFromCompetition, tallyTopScorers, type EspnClient } from '../../src/integration/espnClient';
import type { Logger } from '../../src/lib/logger';
import { sampleMatch } from '../support/testApp';

const noopLogger = { info() {}, warn() {}, error() {}, debug() {} } as unknown as Logger;
const fixedClock = (iso: string) => ({ now: () => new Date(iso) });

describe('espn goal parsing', () => {
  it('reads scorers from competition.details with sides; excludes shootout + own goals from the tally', () => {
    const comp = {
      competitors: [
        { homeAway: 'home', team: { id: 1, displayName: 'Portugal' } },
        { homeAway: 'away', team: { id: 2, displayName: 'Spain' } },
      ],
      details: [
        { scoringPlay: true, team: { id: 1 }, athletesInvolved: [{ id: 7, displayName: 'Ronaldo' }] },
        { scoringPlay: true, team: { id: 1 }, athletesInvolved: [{ id: 7, displayName: 'Ronaldo' }], penaltyKick: true },
        { scoringPlay: false, team: { id: 2 }, athletesInvolved: [{ id: 5, displayName: 'X' }] }, // not a goal
        { scoringPlay: true, team: { id: 2 }, athletesInvolved: [{ id: 9, displayName: 'Morata' }], shootout: true }, // shootout
        { scoringPlay: true, team: { id: 2 }, athletesInvolved: [{ id: 5, displayName: 'Pepe' }], ownGoal: true }, // own goal
      ],
    };
    const { homeName, awayName, goals } = goalsFromCompetition(comp);
    expect([homeName, awayName]).toEqual(['Portugal', 'Spain']);
    expect(goals[0]).toMatchObject({ side: 'HOME', scorerId: '7' }); // first goal = Ronaldo, home

    const real = goals.filter((g) => !g.shootout && !g.ownGoal);
    expect(real).toHaveLength(2); // 2 Ronaldo goals; shootout + own goal excluded
    const tally = tallyTopScorers([{ eventId: 'e', date: '', goals: real.map((g) => ({ scorerId: g.scorerId, scorerName: g.scorerName })) }]);
    expect(tally[0]).toMatchObject({ scorerId: '7', scorerName: 'Ronaldo', goals: 2 });
  });
});

describe('fetchMatchFirstGoals — opening own goal', () => {
  it('attributes the FIRST REAL goal (not an opening own goal) to the scoring side', async () => {
    // Opening goal is an OWN GOAL credited to Portugal (home), then Spain (away) scores the first
    // real goal. The first-goal team must be Spain/AWAY — the own goal must be skipped, not counted
    // for the conceding/benefiting side with a bogus scorer.
    const board = {
      events: [
        {
          date: '2026-06-20T18:00:00.000Z',
          status: { type: { state: 'post' } },
          competitions: [
            {
              competitors: [
                { homeAway: 'home', team: { id: 1, displayName: 'Portugal' } },
                { homeAway: 'away', team: { id: 2, displayName: 'Spain' } },
              ],
              details: [
                // own goal benefiting Portugal (ESPN tags it on the beneficiary side)
                { scoringPlay: true, team: { id: 1 }, athletesInvolved: [{ id: 99, displayName: 'Defender' }], ownGoal: true },
                // first REAL goal: Morata for Spain (away)
                { scoringPlay: true, team: { id: 2 }, athletesInvolved: [{ id: 9, displayName: 'Morata' }] },
              ],
            },
          ],
        },
      ],
    };
    const fakeFetch = (async () => new Response(JSON.stringify(board), { status: 200 })) as unknown as typeof fetch;
    const client = createEspnClient(noopLogger, fakeFetch);
    const [match] = await client.fetchMatchFirstGoals(['20260620']);
    expect(match?.homeName).toBe('Portugal');
    expect(match?.awayName).toBe('Spain');
    expect(match?.first).toEqual({ side: 'AWAY', scorerId: '9', scorerName: 'Morata' });
  });
});

describe('golden boot player pool — negative cache', () => {
  it('does not re-fan-out the ESPN fetch on repeated calls after an empty/failed response', async () => {
    const repos = createMemoryRepositories();
    const now = '2026-06-01T00:00:00.000Z';
    let calls = 0;
    const fakeEspn: EspnClient = {
      async fetchPlayerPool() {
        calls++;
        return []; // empty/failed ESPN response
      },
      async fetchMatchFirstGoals() { return []; },
      async fetchFinishedEventGoals() { return []; },
    };
    const svc = createGoldenBootService(
      repos.goldenBoot,
      repos.stats,
      createMatchService(repos.matches, fixedClock(now)),
      fakeEspn,
      fixedClock(now),
      noopLogger,
    );

    const first = await svc.getPlayerPool();
    const second = await svc.getPlayerPool();
    // Only the FUN_PLAYERS come back, and the empty ESPN fetch is NOT repeated within the cooldown.
    expect(first.length).toBeGreaterThan(0); // FUN_PLAYERS present
    expect(second).toEqual(first);
    expect(calls).toBe(1);
  });
});

describe('golden boot refresh', () => {
  it('sets the leader; bonus pays only once the tournament is over', async () => {
    const repos = createMemoryRepositories();
    const now = '2026-06-20T00:00:00.000Z';
    await repos.matches.upsert(sampleMatch({ id: 'm1', kickoff: '2026-06-11T16:00:00.000Z' }));
    await repos.goldenBoot.put({ playerId: 'sam', scorerId: '7', scorerName: 'Ronaldo', points: 0, createdAt: now, updatedAt: now });
    await repos.goldenBoot.put({ playerId: 'mia', scorerId: '9', scorerName: 'Kane', points: 0, createdAt: now, updatedAt: now });

    const fakeEspn: EspnClient = {
      async fetchPlayerPool() {
        return [];
      },
      async fetchMatchFirstGoals() {
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

    // Mid-tournament: leader is tracked but NO points yet.
    expect((await repos.stats.getLeader())?.scorerName).toBe('Ronaldo'); // 2 goals leads
    expect((await repos.goldenBoot.get('sam'))?.points).toBe(0);

    // Final decided → bonus pays out (force a fresh run past the throttle).
    await repos.matches.upsert(
      sampleMatch({ id: 'fin', stage: 'FINAL', status: 'FINISHED', homeScore: 1, awayScore: 0, winner: 'HOME', kickoff: '2026-07-19T18:00:00.000Z' }),
    );
    await repos.stats.setLastEspnRun('2026-06-19T00:00:00.000Z');
    await svc.refresh();
    expect((await repos.goldenBoot.get('sam'))?.points).toBe(15); // picked the leader
    expect((await repos.goldenBoot.get('mia'))?.points).toBe(0);
  });

  it('a shared Golden Boot (tie at the top) pays EVERY picker of a tied top scorer', async () => {
    const repos = createMemoryRepositories();
    const now = '2026-07-20T00:00:00.000Z';
    // Tournament already over: a decided FINAL exists.
    await repos.matches.upsert(
      sampleMatch({ id: 'fin', stage: 'FINAL', status: 'FINISHED', homeScore: 1, awayScore: 0, winner: 'HOME', kickoff: '2026-06-11T16:00:00.000Z' }),
    );
    // Two scorers tied on 2 goals each; one scorer on 1. Picks: sam->Ronaldo, mia->Kane (both tied), zoe->Lewa (loser).
    await repos.goldenBoot.put({ playerId: 'sam', scorerId: '7', scorerName: 'Ronaldo', points: 0, createdAt: now, updatedAt: now });
    await repos.goldenBoot.put({ playerId: 'mia', scorerId: '9', scorerName: 'Kane', points: 0, createdAt: now, updatedAt: now });
    await repos.goldenBoot.put({ playerId: 'zoe', scorerId: '11', scorerName: 'Lewandowski', points: 0, createdAt: now, updatedAt: now });

    const fakeEspn: EspnClient = {
      async fetchPlayerPool() {
        return [];
      },
      async fetchMatchFirstGoals() {
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
              { scorerId: '9', scorerName: 'Kane' },
              { scorerId: '11', scorerName: 'Lewandowski' },
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

    // Both tied top scorers' pickers are paid the bonus; the picker of the non-leader is not.
    expect((await repos.goldenBoot.get('sam'))?.points).toBe(15);
    expect((await repos.goldenBoot.get('mia'))?.points).toBe(15);
    expect((await repos.goldenBoot.get('zoe'))?.points).toBe(0);
  });
});
