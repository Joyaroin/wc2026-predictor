import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { makeTestApp, sampleMatch } from '../support/testApp';

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

describe('joker (double points)', () => {
  it('doubles the joker match points in the group leaderboard', async () => {
    const t = makeTestApp({ now: new Date('2026-06-16T00:00:00.000Z') });
    const sam = (await request(t.app).post('/api/auth/login').send({ name: 'Sam', pin: '1234' })).body;
    const mia = (await request(t.app).post('/api/auth/login').send({ name: 'Mia', pin: '5678' })).body;
    const group = (await request(t.app).post('/api/groups').set(auth(sam.token)).send({ name: 'F' })).body;
    await request(t.app).post('/api/groups/join').set(auth(mia.token)).send({ inviteCode: group.inviteCode });

    await t.repos.matches.upsert(sampleMatch({ id: 'm1', status: 'FINISHED', homeScore: 2, awayScore: 1 }));
    const now = new Date().toISOString();
    await t.repos.predictions.put({ playerId: sam.playerId, matchId: 'm1', home: 2, away: 1, points: 0, joker: true, createdAt: now, updatedAt: now }); // exact ×2 = 10
    await t.repos.predictions.put({ playerId: mia.playerId, matchId: 'm1', home: 2, away: 1, points: 0, joker: false, createdAt: now, updatedAt: now }); // exact = 5
    await t.services.scoring.scoreMatch('m1');

    const lb = await request(t.app).get(`/api/groups/${group.id}/leaderboard`).set(auth(sam.token));
    expect(lb.body.map((r: { name: string; points: number }) => [r.name, r.points])).toEqual([['Sam', 24], ['Mia', 12]]);
  });

  it('requires a prediction, enforces one joker per match week, and rejects locked matches', async () => {
    const t = makeTestApp({ now: new Date('2026-06-15T10:00:00.000Z') }); // before kickoff
    const sam = (await request(t.app).post('/api/auth/login').send({ name: 'Sam', pin: '1234' })).body;
    await t.repos.matches.upsert(sampleMatch({ id: 'm1', matchday: 1, kickoff: '2026-06-15T18:00:00.000Z' }));
    await t.repos.matches.upsert(sampleMatch({ id: 'm2', matchday: 1, kickoff: '2026-06-15T20:00:00.000Z' }));

    // joker before predicting → 404
    expect((await request(t.app).put('/api/predictions/m1/joker').set(auth(sam.token)).send({ joker: true })).status).toBe(404);

    await request(t.app).put('/api/predictions/m1').set(auth(sam.token)).send({ home: 1, away: 0 });
    await request(t.app).put('/api/predictions/m2').set(auth(sam.token)).send({ home: 2, away: 2 });

    expect((await request(t.app).put('/api/predictions/m1/joker').set(auth(sam.token)).send({ joker: true })).status).toBe(200);
    // setting on m2 (same matchday) clears m1
    await request(t.app).put('/api/predictions/m2/joker').set(auth(sam.token)).send({ joker: true });
    const mine = (await request(t.app).get('/api/predictions/me').set(auth(sam.token))).body as { matchId: string; joker: boolean }[];
    expect(Object.fromEntries(mine.map((p) => [p.matchId, p.joker]))).toEqual({ m1: false, m2: true });
  });

  it('rejects a joker on a locked match', async () => {
    const t = makeTestApp({ now: new Date('2026-06-15T19:00:00.000Z') }); // after kickoff
    const sam = (await request(t.app).post('/api/auth/login').send({ name: 'Sam', pin: '1234' })).body;
    await t.repos.matches.upsert(sampleMatch({ id: 'm1', kickoff: '2026-06-15T18:00:00.000Z' }));
    const now = new Date().toISOString();
    await t.repos.predictions.put({ playerId: sam.playerId, matchId: 'm1', home: 1, away: 0, points: 0, createdAt: now, updatedAt: now });
    expect((await request(t.app).put('/api/predictions/m1/joker').set(auth(sam.token)).send({ joker: true })).status).toBe(409);
  });
});

describe('global leaderboard', () => {
  it('ranks all players by joker-adjusted points', async () => {
    const t = makeTestApp({ now: new Date('2026-06-16T00:00:00.000Z') });
    const sam = (await request(t.app).post('/api/auth/login').send({ name: 'Sam', pin: '1234' })).body;
    const mia = (await request(t.app).post('/api/auth/login').send({ name: 'Mia', pin: '5678' })).body;
    await t.repos.matches.upsert(sampleMatch({ id: 'm1', status: 'FINISHED', homeScore: 2, awayScore: 1 }));
    const now = new Date().toISOString();
    await t.repos.predictions.put({ playerId: sam.playerId, matchId: 'm1', home: 2, away: 1, points: 0, joker: true, createdAt: now, updatedAt: now }); // 10
    await t.repos.predictions.put({ playerId: mia.playerId, matchId: 'm1', home: 3, away: 0, points: 0, joker: false, createdAt: now, updatedAt: now }); // result only = 2
    await t.services.scoring.scoreMatch('m1');

    const g = (await request(t.app).get('/api/leaderboard/global').set(auth(mia.token))).body;
    expect(g.total).toBe(2);
    expect(g.top.map((r: { name: string; points: number }) => [r.name, r.points])).toEqual([['Sam', 24], ['Mia', 2]]);
    expect(g.me.name).toBe('Mia');
  });
});
