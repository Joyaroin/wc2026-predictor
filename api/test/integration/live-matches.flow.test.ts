import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { makeTestApp, sampleMatch } from '../support/testApp';

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

describe('GET /api/live/matches', () => {
  it('returns only in-play/paused matches with minimal fields', async () => {
    const t = makeTestApp({ now: new Date('2026-06-12T12:00:00.000Z') });
    await t.repos.matches.upsert(sampleMatch({ id: 'live1', status: 'IN_PLAY', homeScore: 1, awayScore: 0, minute: 23 }));
    await t.repos.matches.upsert(sampleMatch({ id: 'done1', status: 'FINISHED', homeScore: 2, awayScore: 2 }));
    await t.repos.matches.upsert(sampleMatch({ id: 'sched1', status: 'SCHEDULED' }));
    const login = (await request(t.app).post('/api/auth/login').send({ name: 'Live', pin: '1234' })).body;
    const res = await request(t.app).get('/api/live/matches').set(auth(login.token));
    expect(res.status).toBe(200);
    expect(res.body.map((m: { id: string }) => m.id)).toEqual(['live1']);
    expect(res.body[0]).toEqual({
      id: 'live1', homeScore: 1, awayScore: 0, status: 'IN_PLAY', minute: 23,
      startedAt: res.body[0].startedAt,
    });
  });

  it('includes PAUSED matches alongside IN_PLAY ones', async () => {
    const t = makeTestApp({ now: new Date('2026-06-12T12:00:00.000Z') });
    await t.repos.matches.upsert(sampleMatch({ id: 'live1', status: 'IN_PLAY', homeScore: 1, awayScore: 0, minute: 23 }));
    await t.repos.matches.upsert(sampleMatch({ id: 'paused1', status: 'PAUSED', homeScore: 0, awayScore: 0 }));
    const login = (await request(t.app).post('/api/auth/login').send({ name: 'Live2', pin: '1234' })).body;
    const res = await request(t.app).get('/api/live/matches').set(auth(login.token));
    expect(res.status).toBe(200);
    expect(res.body.map((m: { id: string }) => m.id).sort()).toEqual(['live1', 'paused1']);
  });
});
