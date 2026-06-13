import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { makeTestApp, sampleMatch } from '../support/testApp';

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

describe('joker is committed once its match locks', () => {
  it('cannot be moved to another match in the same section once the holding match has started', async () => {
    // now is after match A's kickoff (locked) but before B's (open). Both are matchweek 1.
    const t = makeTestApp({ now: new Date('2026-06-15T20:00:00.000Z') });
    const sam = (await request(t.app).post('/api/auth/login').send({ name: 'Hedl', pin: '1234' })).body;

    await t.repos.matches.upsert(sampleMatch({ id: 'A', stage: 'GROUP_STAGE', matchday: 1, kickoff: '2026-06-15T18:00:00.000Z', homeTeam: 'Canada', homeCode: 'CAN', awayTeam: 'Bosnia', awayCode: 'BIH', status: 'IN_PLAY', homeScore: 1, awayScore: 0 }));
    await t.repos.matches.upsert(sampleMatch({ id: 'B', stage: 'GROUP_STAGE', matchday: 1, kickoff: '2026-06-15T22:00:00.000Z', homeTeam: 'Mexico', homeCode: 'MEX', awayTeam: 'South Africa', awayCode: 'RSA' }));

    const now = new Date().toISOString();
    // Joker already committed on the (now locked) Canada match; a prediction exists on the open match.
    await t.repos.predictions.put({ playerId: sam.playerId, matchId: 'A', home: 1, away: 0, joker: true, points: 0, createdAt: now, updatedAt: now });
    await t.repos.predictions.put({ playerId: sam.playerId, matchId: 'B', home: 2, away: 1, joker: false, points: 0, createdAt: now, updatedAt: now });

    const res = await request(t.app).put('/api/predictions/B/joker').set(auth(sam.token)).send({ joker: true });
    expect(res.status).toBe(409);

    // The locked match keeps its Joker; the new match does not get one.
    expect((await t.repos.predictions.get(sam.playerId, 'A'))?.joker).toBe(true);
    expect((await t.repos.predictions.get(sam.playerId, 'B'))?.joker).toBe(false);
  });

  it('still moves freely between two open matches in a section', async () => {
    const t = makeTestApp({ now: new Date('2026-06-10T00:00:00.000Z') });
    const sam = (await request(t.app).post('/api/auth/login').send({ name: 'Hedl', pin: '1234' })).body;
    await t.repos.matches.upsert(sampleMatch({ id: 'A', stage: 'GROUP_STAGE', matchday: 1, kickoff: '2026-06-15T18:00:00.000Z', homeCode: 'CAN', awayCode: 'BIH' }));
    await t.repos.matches.upsert(sampleMatch({ id: 'B', stage: 'GROUP_STAGE', matchday: 1, kickoff: '2026-06-15T22:00:00.000Z', homeCode: 'MEX', awayCode: 'RSA' }));
    const now = new Date().toISOString();
    await t.repos.predictions.put({ playerId: sam.playerId, matchId: 'A', home: 1, away: 0, joker: true, points: 0, createdAt: now, updatedAt: now });
    await t.repos.predictions.put({ playerId: sam.playerId, matchId: 'B', home: 2, away: 1, joker: false, points: 0, createdAt: now, updatedAt: now });

    expect((await request(t.app).put('/api/predictions/B/joker').set(auth(sam.token)).send({ joker: true })).status).toBe(200);
    expect((await t.repos.predictions.get(sam.playerId, 'A'))?.joker).toBe(false);
    expect((await t.repos.predictions.get(sam.playerId, 'B'))?.joker).toBe(true);
  });
});
