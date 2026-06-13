import { describe, it, expect } from 'vitest';
import { createEspnClient } from '../../src/integration/espnClient';
import type { Logger } from '../../src/lib/logger';

const noopLogger = { info() {}, warn() {}, error() {}, debug() {} } as unknown as Logger;

function jsonResponse(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as unknown as Response;
}

describe('espnClient.fetchMatchStats', () => {
  it('locates the event by team names and parses box score + lineups', async () => {
    const scoreboard = {
      events: [
        { id: '999', competitions: [{ competitors: [{ team: { displayName: 'Brazil' } }, { team: { displayName: 'France' } }] }] },
        { id: '401', competitions: [{ competitors: [{ team: { displayName: 'Qatar' } }, { team: { displayName: 'Switzerland' } }] }] },
      ],
    };
    const summary = {
      boxscore: {
        teams: [
          { team: { displayName: 'Qatar' }, statistics: [{ name: 'possessionPct', displayValue: '40%' }, { name: 'totalShots', displayValue: '8' }] },
          { team: { displayName: 'Switzerland' }, statistics: [{ name: 'possessionPct', displayValue: '60%' }, { name: 'totalShots', displayValue: '12' }] },
        ],
      },
      rosters: [
        { team: { displayName: 'Qatar' }, formation: '4-3-3', roster: [{ starter: true, jersey: '1', athlete: { displayName: 'Keeper Q' }, position: { abbreviation: 'G' } }] },
        { team: { displayName: 'Switzerland' }, formation: '4-4-2', roster: [{ starter: true, jersey: '9', athlete: { displayName: 'Striker S' }, position: { abbreviation: 'F' } }, { starter: false, athlete: { displayName: 'Sub S' } }] },
      ],
      header: { competitions: [{ status: { type: { shortDetail: "67'" } } }] },
      gameInfo: { venue: { fullName: 'Lusail Stadium' } },
    };

    const fakeFetch = (async (url: string) => {
      if (url.includes('/scoreboard')) return jsonResponse(scoreboard);
      if (url.includes('/summary')) return jsonResponse(summary);
      throw new Error(`unexpected url ${url}`);
    }) as unknown as typeof fetch;

    const espn = createEspnClient(noopLogger, fakeFetch);
    const stats = await espn.fetchMatchStats(['20260613'], 'Qatar', 'Switzerland');

    expect(stats).not.toBeNull();
    expect(stats!.venue).toBe('Lusail Stadium');
    expect(stats!.status).toBe("67'");
    const possession = stats!.stats.find((s) => s.label === 'Possession');
    expect(possession).toEqual({ label: 'Possession', home: '40%', away: '60%' });
    expect(stats!.stats.find((s) => s.label === 'Shots')).toEqual({ label: 'Shots', home: '8', away: '12' });
  });

  it('returns null when no event matches', async () => {
    const fakeFetch = (async () => jsonResponse({ events: [] })) as unknown as typeof fetch;
    const espn = createEspnClient(noopLogger, fakeFetch);
    expect(await espn.fetchMatchStats(['20260613'], 'Qatar', 'Switzerland')).toBeNull();
  });
});
