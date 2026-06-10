import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { makeTestApp, sampleMatch } from '../support/testApp';

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

describe('player of the tournament award', () => {
  it('picks before kickoff, locks after, and admin sets the winner for +25', async () => {
    const t = makeTestApp({ now: new Date('2026-06-10T00:00:00.000Z') });
    const sam = (await request(t.app).post('/api/auth/login').send({ name: 'Sam', pin: '1234' })).body;
    const mia = (await request(t.app).post('/api/auth/login').send({ name: 'Mia', pin: '5678' })).body;
    const group = (await request(t.app).post('/api/groups').set(auth(sam.token)).send({ name: 'F' })).body;
    await request(t.app).post('/api/groups/join').set(auth(mia.token)).send({ inviteCode: group.inviteCode });
    await t.repos.matches.upsert(sampleMatch({ id: 'g1', kickoff: '2026-06-11T16:00:00.000Z' }));

    expect((await request(t.app).put('/api/player-of-tournament').set(auth(sam.token)).send({ winnerId: '7', winnerName: 'Ronaldo' })).status).toBe(200);
    await request(t.app).put('/api/player-of-tournament').set(auth(mia.token)).send({ winnerId: '10', winnerName: 'Messi' });

    // Admin sets the winner — wrong token rejected, right token scores.
    expect((await request(t.app).post('/api/admin/player-of-tournament').set('X-Admin-Token', 'nope').send({ winnerId: '7', winnerName: 'Ronaldo' })).status).toBe(403);
    expect((await request(t.app).post('/api/admin/player-of-tournament').set('X-Admin-Token', 'test-admin-token').send({ winnerId: '7', winnerName: 'Ronaldo' })).status).toBe(200);

    const st = (await request(t.app).get('/api/player-of-tournament').set(auth(sam.token))).body;
    expect(st.winner).toMatchObject({ id: '7', name: 'Ronaldo' });
    expect(st.pick.points).toBe(25);

    const lb = await request(t.app).get(`/api/groups/${group.id}/leaderboard`).set(auth(sam.token));
    expect(lb.body.map((r: { name: string; points: number }) => [r.name, r.points])).toEqual([['Sam', 25], ['Mia', 0]]);
  });

  it('rejects picks after kickoff', async () => {
    const t = makeTestApp({ now: new Date('2026-06-20T00:00:00.000Z') });
    const sam = (await request(t.app).post('/api/auth/login').send({ name: 'Sam', pin: '1234' })).body;
    await t.repos.matches.upsert(sampleMatch({ id: 'g1', kickoff: '2026-06-11T16:00:00.000Z' }));
    expect((await request(t.app).put('/api/player-of-tournament').set(auth(sam.token)).send({ winnerId: '7', winnerName: 'Ronaldo' })).status).toBe(409);
  });
});
