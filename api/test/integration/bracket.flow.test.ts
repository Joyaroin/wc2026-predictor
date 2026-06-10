import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { makeTestApp, sampleMatch } from '../support/testApp';

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

describe('knockout bracket picks', () => {
  it('lets you pick who advances on an open knockout match', async () => {
    const t = makeTestApp({ now: new Date('2026-06-15T10:00:00.000Z') });
    const sam = (await request(t.app).post('/api/auth/login').send({ name: 'Sam', pin: '1234' })).body;
    await t.repos.matches.upsert(
      sampleMatch({ id: 'k1', stage: 'LAST_32', homeTeam: 'Brazil', awayTeam: 'Korea', kickoff: '2026-06-15T18:00:00.000Z' }),
    );
    const res = await request(t.app).put('/api/bracket/k1').set(auth(sam.token)).send({ side: 'HOME' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ matchId: 'k1', side: 'HOME', teamName: 'Brazil' });

    const mine = (await request(t.app).get('/api/bracket/me').set(auth(sam.token))).body;
    expect(mine).toHaveLength(1);
  });

  it('rejects group-stage, placeholder, and locked matches', async () => {
    const t = makeTestApp({ now: new Date('2026-06-15T10:00:00.000Z') });
    const sam = (await request(t.app).post('/api/auth/login').send({ name: 'Sam', pin: '1234' })).body;
    await t.repos.matches.upsert(sampleMatch({ id: 'g1', stage: 'GROUP_STAGE', kickoff: '2026-06-15T18:00:00.000Z' }));
    await t.repos.matches.upsert(sampleMatch({ id: 'k2', stage: 'LAST_32', placeholder: true, kickoff: '2026-06-15T18:00:00.000Z' }));

    expect((await request(t.app).put('/api/bracket/g1').set(auth(sam.token)).send({ side: 'HOME' })).status).toBe(400);
    expect((await request(t.app).put('/api/bracket/k2').set(auth(sam.token)).send({ side: 'HOME' })).status).toBe(400);

    const late = makeTestApp({ now: new Date('2026-06-15T19:00:00.000Z') });
    const s2 = (await request(late.app).post('/api/auth/login').send({ name: 'Sam', pin: '1234' })).body;
    await late.repos.matches.upsert(sampleMatch({ id: 'k3', stage: 'LAST_32', kickoff: '2026-06-15T18:00:00.000Z' }));
    expect((await request(late.app).put('/api/bracket/k3').set(auth(s2.token)).send({ side: 'HOME' })).status).toBe(409);
  });

  it('awards dark-horse points to the correct advancer and feeds the leaderboard', async () => {
    const t = makeTestApp({ now: new Date('2026-07-01T00:00:00.000Z') });
    const sam = (await request(t.app).post('/api/auth/login').send({ name: 'Sam', pin: '1234' })).body;
    const mia = (await request(t.app).post('/api/auth/login').send({ name: 'Mia', pin: '5678' })).body;
    const group = (await request(t.app).post('/api/groups').set(auth(sam.token)).send({ name: 'F' })).body;
    await request(t.app).post('/api/groups/join').set(auth(mia.token)).send({ inviteCode: group.inviteCode });

    // QF, drawn 1-1 at 90' but HOME (Mexico, ×6 dark horse) advanced on penalties.
    await t.repos.matches.upsert(
      sampleMatch({ id: 'k1', stage: 'QUARTER_FINALS', status: 'FINISHED', homeScore: 1, awayScore: 1, winner: 'HOME', homeTeam: 'Mexico', homeCode: 'MEX', awayTeam: 'Korea', awayCode: 'KOR' }),
    );
    const now = new Date().toISOString();
    await t.repos.bracket.put({ playerId: sam.playerId, matchId: 'k1', side: 'HOME', teamName: 'Mexico', points: 0, createdAt: now, updatedAt: now });
    await t.repos.bracket.put({ playerId: mia.playerId, matchId: 'k1', side: 'AWAY', teamName: 'Korea', points: 0, createdAt: now, updatedAt: now });
    await t.services.scoring.scoreMatch('k1');

    // QF weight 3 × Mexico multiplier 6 = 18
    expect((await t.repos.bracket.get(sam.playerId, 'k1'))?.points).toBe(18);
    expect((await t.repos.bracket.get(mia.playerId, 'k1'))?.points).toBe(0);

    const lb = await request(t.app).get(`/api/groups/${group.id}/leaderboard`).set(auth(sam.token));
    expect(lb.body.map((r: { name: string; points: number }) => [r.name, r.points])).toEqual([['Sam', 18], ['Mia', 0]]);
  });
});
