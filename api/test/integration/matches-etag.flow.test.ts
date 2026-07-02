import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { makeTestApp } from '../support/testApp';

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

describe('GET /api/matches ETag', () => {
  it('returns an ETag and 304 when If-None-Match matches', async () => {
    const t = makeTestApp({ now: new Date('2026-06-12T00:00:00.000Z') });
    const login = (await request(t.app).post('/api/auth/login').send({ name: 'Etagger', pin: '1234' })).body;

    const first = await request(t.app).get('/api/matches').set(auth(login.token));
    expect(first.status).toBe(200);
    const etag = first.headers.etag as string;
    expect(etag).toBeTruthy();

    const second = await request(t.app)
      .get('/api/matches')
      .set(auth(login.token))
      .set('If-None-Match', etag);
    expect(second.status).toBe(304);
  });
});
