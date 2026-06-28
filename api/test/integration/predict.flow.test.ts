import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { makeTestApp, sampleMatch } from '../support/testApp';

const KICKOFF = '2026-06-15T18:00:00.000Z';

async function loginToken(app: ReturnType<typeof makeTestApp>['app'], name: string, pin: string): Promise<string> {
  const res = await request(app).post('/api/auth/login').send({ name, pin });
  return res.body.token as string;
}

describe('prediction flow (US-4.x)', () => {
  it('accepts a prediction before kickoff and returns it', async () => {
    const t = makeTestApp({ now: new Date('2026-06-15T10:00:00.000Z') });
    await t.repos.matches.upsert(sampleMatch({ id: 'm1', kickoff: KICKOFF }));
    const token = await loginToken(t.app, 'Sam', '1234');

    const put = await request(t.app)
      .put('/api/predictions/m1')
      .set('Authorization', `Bearer ${token}`)
      .send({ home: 2, away: 1 });
    expect(put.status).toBe(200);
    expect(put.body).toMatchObject({ matchId: 'm1', home: 2, away: 1 });

    const mine = await request(t.app).get('/api/predictions/me').set('Authorization', `Bearer ${token}`);
    expect(mine.body).toHaveLength(1);
  });

  it('deletes a prediction before kickoff; rejects deletion after lock', async () => {
    const t = makeTestApp({ now: new Date('2026-06-15T10:00:00.000Z') });
    await t.repos.matches.upsert(sampleMatch({ id: 'm1', kickoff: KICKOFF }));
    const token = await loginToken(t.app, 'Sam', '1234');

    await request(t.app).put('/api/predictions/m1').set('Authorization', `Bearer ${token}`).send({ home: 2, away: 1 });
    const del = await request(t.app).delete('/api/predictions/m1').set('Authorization', `Bearer ${token}`);
    expect(del.status).toBe(200);
    const mine = await request(t.app).get('/api/predictions/me').set('Authorization', `Bearer ${token}`);
    expect(mine.body).toHaveLength(0);

    const late = makeTestApp({ now: new Date('2026-06-15T19:00:00.000Z') });
    await late.repos.matches.upsert(sampleMatch({ id: 'm1', kickoff: KICKOFF }));
    const t2 = await loginToken(late.app, 'Sam', '1234');
    expect((await request(late.app).delete('/api/predictions/m1').set('Authorization', `Bearer ${t2}`)).status).toBe(409);
  });

  it('rejects a prediction after kickoff (locked)', async () => {
    const t = makeTestApp({ now: new Date('2026-06-15T19:00:00.000Z') }); // after kickoff
    await t.repos.matches.upsert(sampleMatch({ id: 'm1', kickoff: KICKOFF }));
    const token = await loginToken(t.app, 'Sam', '1234');

    const put = await request(t.app)
      .put('/api/predictions/m1')
      .set('Authorization', `Bearer ${token}`)
      .send({ home: 1, away: 1 });
    expect(put.status).toBe(409);
  });

  it('persists penWinner on a draw prediction and returns it', async () => {
    const t = makeTestApp({ now: new Date('2026-06-15T10:00:00.000Z') });
    await t.repos.matches.upsert(sampleMatch({ id: 'm1', kickoff: KICKOFF }));
    const token = await loginToken(t.app, 'Sam', '1234');

    const put = await request(t.app)
      .put('/api/predictions/m1')
      .set('Authorization', `Bearer ${token}`)
      .send({ home: 1, away: 1, penWinner: 'HOME' });
    expect(put.status).toBe(200);
    expect(put.body.penWinner).toBe('HOME');

    const mine = await request(t.app).get('/api/predictions/me').set('Authorization', `Bearer ${token}`);
    expect(mine.body[0].penWinner).toBe('HOME');
  });

  it('rejects an out-of-range score', async () => {
    const t = makeTestApp({ now: new Date('2026-06-15T10:00:00.000Z') });
    await t.repos.matches.upsert(sampleMatch({ id: 'm1', kickoff: KICKOFF }));
    const token = await loginToken(t.app, 'Sam', '1234');

    const put = await request(t.app)
      .put('/api/predictions/m1')
      .set('Authorization', `Bearer ${token}`)
      .send({ home: -1, away: 99 });
    expect(put.status).toBe(400);
  });
});
