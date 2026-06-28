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

    // "This matchday" scope returns a ranked array too (current-section scorelines only).
    const week = await request(t.app).get(`/api/groups/${groupId}/leaderboard?scope=week`).set('Authorization', `Bearer ${samTok}`);
    expect(week.status).toBe(200);
    expect(Array.isArray(week.body)).toBe(true);
    expect(week.body.map((r: { name: string }) => r.name).sort()).toEqual(['Mia', 'Sam']);
  });

  it('player breakdown total reconciles with the leaderboard (joker doubled)', async () => {
    const t = makeTestApp({ now: new Date('2026-06-16T00:00:00.000Z') });
    const sam = await request(t.app).post('/api/auth/login').send({ name: 'Sam', pin: '1234' });
    const tok = sam.body.token as string;
    const pid = sam.body.playerId as string;

    await t.repos.matches.upsert(sampleMatch({ id: 'm1', status: 'FINISHED', homeScore: 2, awayScore: 1 }));
    const now = new Date().toISOString();
    // Exact 2–1 with a Joker → 12 base, doubled to 24 on the leaderboard.
    await t.repos.predictions.put({ playerId: pid, matchId: 'm1', home: 2, away: 1, points: 0, joker: true, createdAt: now, updatedAt: now });
    await t.services.scoring.scoreMatch('m1');

    const global = await request(t.app).get('/api/leaderboard/global').set('Authorization', `Bearer ${tok}`);
    expect(global.status).toBe(200);
    const lbTotal = global.body.me.points as number;
    expect(lbTotal).toBe(24);

    const bd = await request(t.app).get(`/api/players/${pid}/breakdown`).set('Authorization', `Bearer ${tok}`);
    expect(bd.status).toBe(200);
    expect(bd.body.total).toBe(lbTotal); // profile header now matches the leaderboard
    expect(bd.body.rows[0].points).toBe(24); // per-match row is joker-adjusted, not the base 12
    expect(bd.body.awardPoints).toBe(0);
  });

  it('breakdown exposes the penalty-winner result on a knockout draw', async () => {
    const t = makeTestApp({ now: new Date('2026-06-16T00:00:00.000Z') });
    const sam = await request(t.app).post('/api/auth/login').send({ name: 'Sam', pin: '1234' });
    const tok = sam.body.token as string;
    const pid = sam.body.playerId as string;

    await t.repos.matches.upsert(sampleMatch({ id: 'k1', stage: 'LAST_16', status: 'FINISHED', homeScore: 1, awayScore: 1, winner: 'HOME' }));
    const now = new Date().toISOString();
    await t.repos.predictions.put({ playerId: pid, matchId: 'k1', home: 1, away: 1, penWinner: 'HOME', points: 0, createdAt: now, updatedAt: now });
    await t.services.scoring.scoreMatch('k1');

    const bd = await request(t.app).get(`/api/players/${pid}/breakdown`).set('Authorization', `Bearer ${tok}`);
    expect(bd.status).toBe(200);
    const row = bd.body.rows.find((r: { matchId: string }) => r.matchId === 'k1');
    expect(row.breakdown.penWinner).toEqual({ picked: 'HOME', hit: true });
    expect(row.points).toBe(17); // exact 1-1 (12) + pen (5)
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
