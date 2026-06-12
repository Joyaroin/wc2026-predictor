import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { makeTestApp } from '../support/testApp';

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

describe('onboarding tour seen flag (per account)', () => {
  it('is false for a new user, persists once marked, and survives re-login', async () => {
    const t = makeTestApp({ now: new Date('2026-06-12T00:00:00.000Z') });

    const first = (await request(t.app).post('/api/auth/login').send({ name: 'Newbie', pin: '1234' })).body;
    expect(first.tourSeen).toBe(false);
    expect((await request(t.app).get('/api/players/me').set(auth(first.token))).body.tourSeen).toBe(false);

    expect((await request(t.app).post('/api/players/me/tour-seen').set(auth(first.token))).status).toBe(200);
    expect((await request(t.app).get('/api/players/me').set(auth(first.token))).body.tourSeen).toBe(true);

    // Logging in again (e.g. another device) reflects the persisted flag.
    const again = (await request(t.app).post('/api/auth/login').send({ name: 'Newbie', pin: '1234' })).body;
    expect(again.tourSeen).toBe(true);
  });
});
