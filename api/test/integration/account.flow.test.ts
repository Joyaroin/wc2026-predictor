import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { makeTestApp } from '../support/testApp';

async function login(app: ReturnType<typeof makeTestApp>['app'], name: string, pin: string) {
  return request(app).post('/api/auth/login').send({ name, pin });
}

describe('change PIN (US-1.x / SECURITY-12)', () => {
  it('changes the PIN with the correct current PIN, and the new PIN then works', async () => {
    const { app } = makeTestApp();
    const sam = await login(app, 'Sam', '1234');
    const token = sam.body.token as string;

    const change = await request(app)
      .post('/api/players/me/pin')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPin: '1234', newPin: '5678' });
    expect(change.status).toBe(200);

    expect((await login(app, 'Sam', '1234')).status).toBe(401); // old PIN rejected
    expect((await login(app, 'Sam', '5678')).status).toBe(200); // new PIN accepted
  });

  it('rejects a PIN change when the current PIN is wrong', async () => {
    const { app } = makeTestApp();
    const sam = await login(app, 'Sam', '1234');
    const res = await request(app)
      .post('/api/players/me/pin')
      .set('Authorization', `Bearer ${sam.body.token}`)
      .send({ currentPin: '0000', newPin: '5678' });
    expect(res.status).toBe(401);
  });
});

describe('delete / leave group (US-2.x)', () => {
  it('lets the creator delete the group', async () => {
    const { app } = makeTestApp();
    const sam = await login(app, 'Sam', '1234');
    const group = await request(app).post('/api/groups').set('Authorization', `Bearer ${sam.body.token}`).send({ name: 'Friends' });
    const del = await request(app).delete(`/api/groups/${group.body.id}`).set('Authorization', `Bearer ${sam.body.token}`);
    expect(del.status).toBe(200);
    expect((await request(app).get('/api/groups').set('Authorization', `Bearer ${sam.body.token}`)).body).toHaveLength(0);
  });

  it('forbids a non-creator from deleting, but lets them leave', async () => {
    const { app } = makeTestApp();
    const sam = await login(app, 'Sam', '1234');
    const mia = await login(app, 'Mia', '5678');
    const group = await request(app).post('/api/groups').set('Authorization', `Bearer ${sam.body.token}`).send({ name: 'Friends' });
    await request(app).post('/api/groups/join').set('Authorization', `Bearer ${mia.body.token}`).send({ inviteCode: group.body.inviteCode });

    const del = await request(app).delete(`/api/groups/${group.body.id}`).set('Authorization', `Bearer ${mia.body.token}`);
    expect(del.status).toBe(403);

    const leave = await request(app).post(`/api/groups/${group.body.id}/leave`).set('Authorization', `Bearer ${mia.body.token}`);
    expect(leave.status).toBe(200);
    expect((await request(app).get('/api/groups').set('Authorization', `Bearer ${mia.body.token}`)).body).toHaveLength(0);
    // group still exists for Sam
    expect((await request(app).get('/api/groups').set('Authorization', `Bearer ${sam.body.token}`)).body).toHaveLength(1);
  });
});
