import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { makeTestApp, sampleMatch } from '../support/testApp';

const KICKOFF = '2026-06-15T18:00:00.000Z';

async function loginToken(app: ReturnType<typeof makeTestApp>['app'], name: string, pin: string): Promise<string> {
  const res = await request(app).post('/api/auth/login').send({ name, pin });
  return res.body.token as string;
}

// Defence-in-depth: strict request schemas reject unknown keys (attribute / mass-assignment
// injection attempts), and path params can't smuggle the single-table key delimiter.
describe('injection hardening', () => {
  it('rejects unknown keys in a prediction body (strict schema)', async () => {
    const t = makeTestApp({ now: new Date('2026-06-15T10:00:00.000Z') });
    await t.repos.matches.upsert(sampleMatch({ id: 'm1', kickoff: KICKOFF }));
    const token = await loginToken(t.app, 'Sam', '1234');

    // `points` is server-computed; a client must not be able to smuggle it in.
    const put = await request(t.app)
      .put('/api/predictions/m1')
      .set('Authorization', `Bearer ${token}`)
      .send({ home: 2, away: 1, points: 9999 });
    expect(put.status).toBe(400);
  });

  it('still accepts a clean prediction body', async () => {
    const t = makeTestApp({ now: new Date('2026-06-15T10:00:00.000Z') });
    await t.repos.matches.upsert(sampleMatch({ id: 'm1', kickoff: KICKOFF }));
    const token = await loginToken(t.app, 'Sam', '1234');

    const put = await request(t.app)
      .put('/api/predictions/m1')
      .set('Authorization', `Bearer ${token}`)
      .send({ home: 2, away: 1 });
    expect(put.status).toBe(200);
  });

  it('rejects a path param carrying the key delimiter', async () => {
    const t = makeTestApp({ now: new Date('2026-06-15T10:00:00.000Z') });
    const token = await loginToken(t.app, 'Sam', '1234');

    // 'm1#MEMBER#x' would otherwise build a key that crosses entity types.
    const res = await request(t.app)
      .put('/api/predictions/' + encodeURIComponent('m1#MEMBER#x'))
      .set('Authorization', `Bearer ${token}`)
      .send({ home: 1, away: 0 });
    expect(res.status).toBe(400);
  });

  it('rejects unknown keys in a chat message body', async () => {
    const t = makeTestApp({ now: new Date('2026-06-15T10:00:00.000Z') });
    const token = await loginToken(t.app, 'Sam', '1234');

    const res = await request(t.app)
      .post('/api/messages/global')
      .set('Authorization', `Bearer ${token}`)
      .send({ text: 'hi', playerName: 'Admin', isAdmin: true });
    expect(res.status).toBe(400);
  });
});
