import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { makeTestApp, sampleMatch } from '../support/testApp';

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

async function seedGroups(t: ReturnType<typeof makeTestApp>) {
  await t.repos.matches.upsert(sampleMatch({ id: 'g1', stage: 'GROUP_STAGE', kickoff: '2026-06-15T18:00:00.000Z', homeTeam: 'Brazil', homeCode: 'BRA', awayTeam: 'France', awayCode: 'FRA' }));
  await t.repos.matches.upsert(sampleMatch({ id: 'g2', stage: 'GROUP_STAGE', kickoff: '2026-06-15T18:00:00.000Z', homeTeam: 'Spain', homeCode: 'ESP', awayTeam: 'Mexico', awayCode: 'MEX' }));
}

describe('tournament winner award', () => {
  it('locks after kickoff and rejects unknown teams', async () => {
    const t = makeTestApp({ now: new Date('2026-06-10T00:00:00.000Z') });
    const sam = (await request(t.app).post('/api/auth/login').send({ name: 'Sam', pin: '1234' })).body;
    await seedGroups(t);
    expect((await request(t.app).put('/api/tournament-winner').set(auth(sam.token)).send({ teamCode: 'BRA', teamName: 'Brazil' })).status).toBe(200);
    expect((await request(t.app).put('/api/tournament-winner').set(auth(sam.token)).send({ teamCode: 'ZZZ', teamName: 'X' })).status).toBe(400);

    const late = makeTestApp({ now: new Date('2026-06-20T00:00:00.000Z') });
    const s2 = (await request(late.app).post('/api/auth/login').send({ name: 'Sam', pin: '1234' })).body;
    await seedGroups(late);
    expect((await request(late.app).put('/api/tournament-winner').set(auth(s2.token)).send({ teamCode: 'BRA', teamName: 'Brazil' })).status).toBe(409);
  });

  it('awards +10 to whoever picked the champion', async () => {
    const t = makeTestApp({ now: new Date('2026-06-10T00:00:00.000Z') });
    const sam = (await request(t.app).post('/api/auth/login').send({ name: 'Sam', pin: '1234' })).body;
    const mia = (await request(t.app).post('/api/auth/login').send({ name: 'Mia', pin: '5678' })).body;
    await seedGroups(t);
    await request(t.app).put('/api/tournament-winner').set(auth(sam.token)).send({ teamCode: 'BRA', teamName: 'Brazil' });
    await request(t.app).put('/api/tournament-winner').set(auth(mia.token)).send({ teamCode: 'FRA', teamName: 'France' });

    // Final: Brazil beat France → champion BRA
    await t.repos.matches.upsert(sampleMatch({ id: 'f1', stage: 'FINAL', status: 'FINISHED', homeScore: 1, awayScore: 0, winner: 'HOME', homeTeam: 'Brazil', homeCode: 'BRA', awayTeam: 'France', awayCode: 'FRA' }));
    await t.services.tournamentWinner.refresh();

    expect((await t.repos.tournamentWinner.get(sam.playerId))?.points).toBe(10);
    expect((await t.repos.tournamentWinner.get(mia.playerId))?.points).toBe(0);

    const status = (await request(t.app).get('/api/tournament-winner').set(auth(sam.token))).body;
    expect(status.champion).toMatchObject({ code: 'BRA' });
  });
});
