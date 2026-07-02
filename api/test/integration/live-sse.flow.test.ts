import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { makeTestApp } from '../support/testApp';

describe('GET /api/live SSE', () => {
  it('rejects without a token', async () => {
    const t = makeTestApp();
    const res = await request(t.app).get('/api/live');
    expect(res.status).toBe(401);
  });

  it('opens an event-stream with a valid token', async () => {
    const t = makeTestApp();
    const login = (await request(t.app).post('/api/auth/login').send({ name: 'Streamer', pin: '1234' })).body;
    // SSE responses never complete, so supertest's promise interface (which awaits
    // the 'end' event) never resolves. Instead, listen for the 'response' event
    // directly (fires once headers arrive), then destroy the response stream —
    // this closes the connection cleanly (server sees req 'close') without the
    // ECONNRESET/uncaught-exception noise that superagent's own .abort() causes
    // once a response is already in flight.
    const req = request(t.app).get(`/api/live?token=${login.token}`).buffer(false);
    const res = await new Promise<{ headers: Record<string, string>; destroy: () => void }>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timed out waiting for SSE response headers')), 2000);
      req.on('response', (r: { headers: Record<string, string>; destroy: () => void }) => {
        clearTimeout(timer);
        resolve(r);
      });
      req.end();
    });
    res.destroy();
    expect(res.headers['content-type']).toContain('text/event-stream');
  });
});
