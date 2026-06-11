import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { makeTestApp, sampleMatch } from '../support/testApp';

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

// Group matches so HAI, FRA, QAT are valid picks; a FINAL with HAI vs FRA = both "reached the final".
async function seed(t: ReturnType<typeof makeTestApp>) {
  await t.repos.matches.upsert(sampleMatch({ id: 'g1', stage: 'GROUP_STAGE', kickoff: '2026-06-15T18:00:00.000Z', homeTeam: 'Haiti', homeCode: 'HAI', awayTeam: 'France', awayCode: 'FRA' }));
  await t.repos.matches.upsert(sampleMatch({ id: 'g2', stage: 'GROUP_STAGE', kickoff: '2026-06-15T18:00:00.000Z', homeTeam: 'Qatar', homeCode: 'QAT', awayTeam: 'Mexico', awayCode: 'MEX' }));
  await t.repos.matches.upsert(sampleMatch({ id: 'f1', stage: 'FINAL', kickoff: '2026-07-19T18:00:00.000Z', homeTeam: 'Haiti', homeCode: 'HAI', awayTeam: 'France', awayCode: 'FRA' }));
}

describe('dark horse award', () => {
  it('lets you pick a team before kickoff, rejects unknown teams and post-kickoff picks', async () => {
    const t = makeTestApp({ now: new Date('2026-06-10T00:00:00.000Z') });
    const sam = (await request(t.app).post('/api/auth/login').send({ name: 'Sam', pin: '1234' })).body;
    await seed(t);

    const ok = await request(t.app).put('/api/dark-horse').set(auth(sam.token)).send({ teamCode: 'HAI', teamName: 'Haiti' });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ teamCode: 'HAI', teamName: 'Haiti' });

    expect((await request(t.app).put('/api/dark-horse').set(auth(sam.token)).send({ teamCode: 'ZZZ', teamName: 'Nowhere' })).status).toBe(400);

    const status = (await request(t.app).get('/api/dark-horse').set(auth(sam.token))).body;
    expect(status.teams.length).toBeGreaterThanOrEqual(4); // HAI, FRA, QAT, MEX
    expect(status.pick.teamCode).toBe('HAI');

    const late = makeTestApp({ now: new Date('2026-06-20T00:00:00.000Z') });
    const s2 = (await request(late.app).post('/api/auth/login').send({ name: 'Sam', pin: '1234' })).body;
    await seed(late);
    expect((await request(late.app).put('/api/dark-horse').set(auth(s2.token)).send({ teamCode: 'HAI', teamName: 'Haiti' })).status).toBe(409);
  });

  it('ranks by probability × deepest-stage weight (lowest wins) and pays 20/10/5', async () => {
    const t = makeTestApp({ now: new Date('2026-06-10T00:00:00.000Z') });
    const sam = (await request(t.app).post('/api/auth/login').send({ name: 'Sam', pin: '1234' })).body;
    const mia = (await request(t.app).post('/api/auth/login').send({ name: 'Mia', pin: '5678' })).body;
    const bob = (await request(t.app).post('/api/auth/login').send({ name: 'Bob', pin: '9012' })).body;
    const group = (await request(t.app).post('/api/groups').set(auth(sam.token)).send({ name: 'F' })).body;
    await request(t.app).post('/api/groups/join').set(auth(mia.token)).send({ inviteCode: group.inviteCode });
    await request(t.app).post('/api/groups/join').set(auth(bob.token)).send({ inviteCode: group.inviteCode });
    await seed(t);

    await request(t.app).put('/api/dark-horse').set(auth(sam.token)).send({ teamCode: 'HAI', teamName: 'Haiti' }); // 0.1 × final(1) = 0.1 → 1st
    await request(t.app).put('/api/dark-horse').set(auth(mia.token)).send({ teamCode: 'QAT', teamName: 'Qatar' }); // 0.3 × group(5000) = 1500 → 3rd
    await request(t.app).put('/api/dark-horse').set(auth(bob.token)).send({ teamCode: 'FRA', teamName: 'France' }); // 18.6 × final(1) = 18.6 → 2nd

    // Mid-tournament: no points yet (final undecided).
    await t.services.darkHorse.refresh();
    expect((await t.repos.darkHorse.get(sam.playerId))?.points).toBe(0);

    // Final decided → placements pay out.
    await t.repos.matches.upsert(sampleMatch({ id: 'f1', stage: 'FINAL', status: 'FINISHED', homeScore: 1, awayScore: 0, winner: 'HOME', kickoff: '2026-07-19T18:00:00.000Z', homeTeam: 'Haiti', homeCode: 'HAI', awayTeam: 'France', awayCode: 'FRA' }));
    await t.services.darkHorse.refresh();

    expect((await t.repos.darkHorse.get(sam.playerId))?.points).toBe(20);
    expect((await t.repos.darkHorse.get(bob.playerId))?.points).toBe(10);
    expect((await t.repos.darkHorse.get(mia.playerId))?.points).toBe(5);

    const lb = await request(t.app).get(`/api/groups/${group.id}/leaderboard`).set(auth(sam.token));
    expect(lb.body.map((r: { name: string; points: number }) => [r.name, r.points])).toEqual([['Sam', 20], ['Bob', 10], ['Mia', 5]]);
  });
});
