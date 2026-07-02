import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { makeTestApp, testConfig } from '../support/testApp';
import { verifySession } from '../../src/lib/token';

describe('GET /api/live-token', () => {
  it('rejects without a Bearer token', async () => {
    const t = makeTestApp();
    const res = await request(t.app).get('/api/live-token');
    expect(res.status).toBe(401);
  });

  it('issues a short-lived token usable for /live', async () => {
    const t = makeTestApp();
    const login = (await request(t.app).post('/api/auth/login').send({ name: 'Streamer', pin: '1234' })).body;
    const res = await request(t.app).get('/api/live-token').set('Authorization', `Bearer ${login.token}`);
    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.token.length).toBeGreaterThan(0);

    // Proves the token is a valid session token for the caller, and thus usable
    // as /live's ?token= query param (which relies on verifySession too).
    expect(verifySession(res.body.token, testConfig.sessionSigningSecret)).toBe(login.playerId);
  });
});
