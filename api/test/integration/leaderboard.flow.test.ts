import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { makeTestApp, sampleMatch } from '../support/testApp';

describe('leaderboard flow (US-2.x / US-5.x)', () => {
  it('ranks group members by points (exact > result)', async () => {
    const t = makeTestApp({ now: new Date('2026-06-16T00:00:00.000Z') });

    const sam = await request(t.app).post('/api/auth/login').send({ name: 'Sam', pin: '1234' });
    const mia = await request(t.app).post('/api/auth/login').send({ name: 'Mia', pin: '5678' });
    const samTok = sam.body.token as string;
    const miaTok = mia.body.token as string;

    // Sam creates a group, Mia joins via the invite code.
    const group = await request(t.app).post('/api/groups').set('Authorization', `Bearer ${samTok}`).send({ name: 'Friends' });
    expect(group.status).toBe(200);
    const code = group.body.inviteCode as string;
    const groupId = group.body.id as string;
    const join = await request(t.app).post('/api/groups/join').set('Authorization', `Bearer ${miaTok}`).send({ inviteCode: code });
    expect(join.status).toBe(200);

    // A finished match + predictions, then score it.
    await t.repos.matches.upsert(sampleMatch({ id: 'm1', status: 'FINISHED', homeScore: 2, awayScore: 1 }));
    const now = new Date().toISOString();
    await t.repos.predictions.put({ playerId: sam.body.playerId, matchId: 'm1', home: 2, away: 1, points: 0, createdAt: now, updatedAt: now }); // exact
    await t.repos.predictions.put({ playerId: mia.body.playerId, matchId: 'm1', home: 3, away: 0, points: 0, createdAt: now, updatedAt: now }); // home win, wrong margin → result only (2)
    await t.services.scoring.scoreMatch('m1');

    const lb = await request(t.app).get(`/api/groups/${groupId}/leaderboard`).set('Authorization', `Bearer ${samTok}`);
    expect(lb.status).toBe(200);
    expect(lb.body.map((r: { name: string; points: number; rank: number }) => [r.rank, r.name, r.points])).toEqual([
      [1, 'Sam', 12],
      [2, 'Mia', 2],
    ]);
  });

  it('forbids non-members from reading a group leaderboard', async () => {
    const t = makeTestApp();
    const sam = await request(t.app).post('/api/auth/login').send({ name: 'Sam', pin: '1234' });
    const outsider = await request(t.app).post('/api/auth/login').send({ name: 'Eve', pin: '4444' });
    const group = await request(t.app).post('/api/groups').set('Authorization', `Bearer ${sam.body.token}`).send({ name: 'Friends' });

    const res = await request(t.app)
      .get(`/api/groups/${group.body.id}/leaderboard`)
      .set('Authorization', `Bearer ${outsider.body.token}`);
    expect(res.status).toBe(403);
  });
});
