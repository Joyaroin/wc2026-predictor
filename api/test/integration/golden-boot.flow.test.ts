import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { makeTestApp, sampleMatch } from '../support/testApp';

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

describe('golden boot (player of the tournament)', () => {
  it('lets you pick before kickoff and reports it', async () => {
    const t = makeTestApp({ now: new Date('2026-06-10T00:00:00.000Z') });
    const sam = (await request(t.app).post('/api/auth/login').send({ name: 'Sam', pin: '1234' })).body;
    await t.repos.matches.upsert(sampleMatch({ id: 'm1', kickoff: '2026-06-11T16:00:00.000Z' }));

    const res = await request(t.app).put('/api/golden-boot').set(auth(sam.token)).send({ scorerId: '123', scorerName: 'Kylian Mbappé' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ scorerId: '123', scorerName: 'Kylian Mbappé' });

    const st = (await request(t.app).get('/api/golden-boot').set(auth(sam.token))).body;
    expect(st.pick.scorerName).toBe('Kylian Mbappé');
    expect(st.locked).toBe(false);
  });

  it('locks picks once the tournament has started', async () => {
    const t = makeTestApp({ now: new Date('2026-06-20T00:00:00.000Z') });
    const sam = (await request(t.app).post('/api/auth/login').send({ name: 'Sam', pin: '1234' })).body;
    await t.repos.matches.upsert(sampleMatch({ id: 'm1', kickoff: '2026-06-11T16:00:00.000Z' }));
    expect((await request(t.app).put('/api/golden-boot').set(auth(sam.token)).send({ scorerId: '1', scorerName: 'X' })).status).toBe(409);
  });

  it('golden-boot bonus feeds the leaderboard', async () => {
    const t = makeTestApp({ now: new Date('2026-07-20T00:00:00.000Z') });
    const sam = (await request(t.app).post('/api/auth/login').send({ name: 'Sam', pin: '1234' })).body;
    const mia = (await request(t.app).post('/api/auth/login').send({ name: 'Mia', pin: '5678' })).body;
    const group = (await request(t.app).post('/api/groups').set(auth(sam.token)).send({ name: 'F' })).body;
    await request(t.app).post('/api/groups/join').set(auth(mia.token)).send({ inviteCode: group.inviteCode });

    const now = new Date().toISOString();
    await t.repos.goldenBoot.put({ playerId: sam.playerId, scorerId: '9', scorerName: 'Kane', points: 15, createdAt: now, updatedAt: now });
    const lb = await request(t.app).get(`/api/groups/${group.id}/leaderboard`).set(auth(sam.token));
    expect(lb.body.map((r: { name: string; points: number }) => [r.name, r.points])).toEqual([['Sam', 15], ['Mia', 0]]);
  });
});
