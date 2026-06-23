import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { makeTestApp, sampleMatch } from '../support/testApp';

const KICKOFF = '2026-06-15T18:00:00.000Z';

async function loginToken(app: ReturnType<typeof makeTestApp>['app'], name: string, pin: string): Promise<string> {
  const res = await request(app).post('/api/auth/login').send({ name, pin });
  return res.body.token as string;
}

// "Who picked what" — global predictions for a match (everyone playing).
describe('global match predictions', () => {
  it('shows only the caller’s own pick before kickoff', async () => {
    const t = makeTestApp({ now: new Date('2026-06-15T10:00:00.000Z') });
    await t.repos.matches.upsert(sampleMatch({ id: 'm1', kickoff: KICKOFF }));
    const sam = await loginToken(t.app, 'Sam', '1234');
    const ana = await loginToken(t.app, 'Ana', '4321');
    await request(t.app).put('/api/predictions/m1').set('Authorization', `Bearer ${sam}`).send({ home: 2, away: 1 });
    await request(t.app).put('/api/predictions/m1').set('Authorization', `Bearer ${ana}`).send({ home: 0, away: 0 });

    const res = await request(t.app).get('/api/matches/m1/predictions').set('Authorization', `Bearer ${sam}`);
    expect(res.status).toBe(200);
    expect(res.body.locked).toBe(false);
    expect(res.body.predictions).toHaveLength(1);
    expect(res.body.predictions[0].name).toBe('Sam');
  });

  it('reveals everyone’s picks once the match is locked', async () => {
    const t = makeTestApp({ now: new Date('2026-06-15T20:00:00.000Z') }); // after kickoff
    await t.repos.matches.upsert(sampleMatch({ id: 'm1', kickoff: KICKOFF, homeScore: 2, awayScore: 1 }));
    const sam = await loginToken(t.app, 'Sam', '1234');
    await loginToken(t.app, 'Ana', '4321');

    const players = await t.repos.players.listAll();
    const samId = players.find((p) => p.name === 'Sam')!.id;
    const anaId = players.find((p) => p.name === 'Ana')!.id;
    const base = { firstTeam: null, firstScorerId: null, firstScorerName: null, joker: false, createdAt: KICKOFF, updatedAt: KICKOFF };
    await t.repos.predictions.put({ playerId: samId, matchId: 'm1', home: 2, away: 1, points: 20, exact: true, ...base });
    await t.repos.predictions.put({ playerId: anaId, matchId: 'm1', home: 0, away: 0, points: 0, exact: false, ...base });

    const res = await request(t.app).get('/api/matches/m1/predictions').set('Authorization', `Bearer ${sam}`);
    expect(res.status).toBe(200);
    expect(res.body.locked).toBe(true);
    expect(res.body.predictions).toHaveLength(2);
    const names = res.body.predictions.map((p: { name: string }) => p.name).sort();
    expect(names).toEqual(['Ana', 'Sam']);
  });
});
