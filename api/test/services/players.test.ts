import { describe, it, expect } from 'vitest';
import { createMemoryRepositories } from '../../src/repos/memory';
import { createPlayerService } from '../../src/services/players';
import type { Repositories } from '../../src/repos/types';
import { ForbiddenError } from '../../src/lib/errors';
import { hashPin } from '../../src/lib/pin';

async function seed(repos: Repositories, id: string, name: string): Promise<void> {
  const now = new Date().toISOString();
  await repos.players.create({
    id,
    name,
    nameKey: name.trim().toLowerCase(),
    pinHash: await hashPin('1234'),
    createdAt: now,
    updatedAt: now,
  });
}

describe('PlayerService.rename — reserved admin name', () => {
  it('rejects a non-admin renaming to the configured admin name (privesc guard)', async () => {
    const repos = createMemoryRepositories();
    await seed(repos, 'u1', 'Bob');
    const svc = createPlayerService(repos.players, 'adham');

    await expect(svc.rename('u1', 'Adham')).rejects.toBeInstanceOf(ForbiddenError);
    expect((await repos.players.getById('u1'))?.name).toBe('Bob'); // unchanged
  });

  it('lets the admin re-claim its own reserved name (e.g. casing change)', async () => {
    const repos = createMemoryRepositories();
    await seed(repos, 'admin', 'adham'); // already owns the reserved nameKey
    const svc = createPlayerService(repos.players, 'adham');

    const res = await svc.rename('admin', 'Adham');
    expect(res.name).toBe('Adham');
  });

  it('reserves no name when adminPlayer is empty', async () => {
    const repos = createMemoryRepositories();
    await seed(repos, 'u1', 'Bob');
    const svc = createPlayerService(repos.players, '');

    const res = await svc.rename('u1', 'Adham');
    expect(res.name).toBe('Adham');
  });
});
