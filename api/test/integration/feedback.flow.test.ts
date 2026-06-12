import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { makeTestApp } from '../support/testApp';

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

describe('feedback', () => {
  it('lets a user submit, and only an admin can read it', async () => {
    const t = makeTestApp({ now: new Date('2026-06-12T00:00:00.000Z') });
    const sam = (await request(t.app).post('/api/auth/login').send({ name: 'Sam', pin: '1234' })).body;

    expect((await request(t.app).post('/api/feedback').set(auth(sam.token)).send({ message: 'Joker button is greyed out', page: 'Fixtures' })).status).toBe(200);
    expect((await request(t.app).post('/api/feedback').set(auth(sam.token)).send({ message: '' })).status).toBe(400); // empty rejected

    // Admin read: wrong/no token rejected, right token returns the report.
    expect((await request(t.app).get('/api/admin/feedback')).status).toBe(403);
    expect((await request(t.app).get('/api/admin/feedback').set('X-Admin-Token', 'nope')).status).toBe(403);

    const list = await request(t.app).get('/api/admin/feedback').set('X-Admin-Token', 'test-admin-token');
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0]).toMatchObject({ playerName: 'Sam', message: 'Joker button is greyed out', page: 'Fixtures' });
  });

  it('shows the inbox to the owner account (Adham) but not to others', async () => {
    const t = makeTestApp({ now: new Date('2026-06-12T00:00:00.000Z') });
    const sam = (await request(t.app).post('/api/auth/login').send({ name: 'Sam', pin: '1234' })).body;
    const adham = (await request(t.app).post('/api/auth/login').send({ name: 'Adham', pin: '2579' })).body;
    await request(t.app).post('/api/feedback').set(auth(sam.token)).send({ message: 'typo on awards page' });

    expect((await request(t.app).get('/api/feedback/admin/me').set(auth(sam.token))).body.isAdmin).toBe(false);
    expect((await request(t.app).get('/api/feedback/admin/me').set(auth(adham.token))).body.isAdmin).toBe(true);

    expect((await request(t.app).get('/api/feedback/admin').set(auth(sam.token))).status).toBe(403);
    const list = await request(t.app).get('/api/feedback/admin').set(auth(adham.token));
    expect(list.status).toBe(200);
    expect(list.body[0]).toMatchObject({ playerName: 'Sam', message: 'typo on awards page' });
  });
});
