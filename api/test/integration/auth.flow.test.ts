import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { makeTestApp } from '../support/testApp';

describe('auth flow (US-1.1/1.2)', () => {
  it('signs up, resumes with same name+PIN, and rejects wrong PIN', async () => {
    const { app } = makeTestApp();

    const signup = await request(app).post('/api/auth/login').send({ name: 'Sam', pin: '1234' });
    expect(signup.status).toBe(200);
    expect(signup.body.token).toBeTruthy();
    const firstId = signup.body.playerId;

    const resume = await request(app).post('/api/auth/login').send({ name: 'Sam', pin: '1234' });
    expect(resume.status).toBe(200);
    expect(resume.body.playerId).toBe(firstId); // same identity (cross-device resume)

    const wrong = await request(app).post('/api/auth/login').send({ name: 'Sam', pin: '0000' });
    expect(wrong.status).toBe(401);
  });

  it('rejects an invalid PIN format', async () => {
    const { app } = makeTestApp();
    const res = await request(app).post('/api/auth/login').send({ name: 'Sam', pin: '12' });
    expect(res.status).toBe(400);
  });

  it('returns 400 (not 500) for malformed JSON bodies', async () => {
    const { app } = makeTestApp();
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('"name":"broken"'); // invalid JSON
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/malformed/i);
  });

  it('requires a session token for protected routes', async () => {
    const { app } = makeTestApp();
    expect((await request(app).get('/api/players/me')).status).toBe(401);

    const login = await request(app).post('/api/auth/login').send({ name: 'Mia', pin: '9999' });
    const me = await request(app).get('/api/players/me').set('Authorization', `Bearer ${login.body.token}`);
    expect(me.status).toBe(200);
    expect(me.body.name).toBe('Mia');
  });

  it('refuses to register the configured admin name via signup (case-insensitive)', async () => {
    const { app } = makeTestApp(); // testConfig.adminPlayer === 'adham'
    expect((await request(app).post('/api/auth/login').send({ name: 'Adham', pin: '1234' })).status).toBe(409);
    expect((await request(app).post('/api/auth/login').send({ name: 'ADHAM', pin: '1234' })).status).toBe(409);
  });
});
