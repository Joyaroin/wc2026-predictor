// Memory-repo behavior that must mirror the dynamo backend.
// (Live DynamoDB is not available here, so the dynamo equivalents are exercised only by inspection.)
import { describe, it, expect } from 'vitest';
import { createMemoryRepositories } from '../../src/repos/memory';

describe('MembershipRepo (memory) — joinedAt retention', () => {
  it('retains joinedAt passed to add() (was previously dropped)', async () => {
    const repos = createMemoryRepositories();
    const joinedAt = '2026-06-12T10:00:00.000Z';
    await repos.memberships.add('g1', 'p1', joinedAt);

    expect(await repos.memberships.isMember('g1', 'p1')).toBe(true);
    expect(await repos.memberships.getJoinedAt?.('g1', 'p1')).toBe(joinedAt);
  });

  it('keeps each member’s own joinedAt independently', async () => {
    const repos = createMemoryRepositories();
    await repos.memberships.add('g1', 'a', '2026-06-01T00:00:00.000Z');
    await repos.memberships.add('g1', 'b', '2026-06-02T00:00:00.000Z');

    expect(await repos.memberships.getJoinedAt?.('g1', 'a')).toBe('2026-06-01T00:00:00.000Z');
    expect(await repos.memberships.getJoinedAt?.('g1', 'b')).toBe('2026-06-02T00:00:00.000Z');
    expect([...(await repos.memberships.listMembers('g1'))].sort()).toEqual(['a', 'b']);
  });

  it('re-adding a member updates their joinedAt and does not duplicate membership', async () => {
    const repos = createMemoryRepositories();
    await repos.memberships.add('g1', 'p1', '2026-06-01T00:00:00.000Z');
    await repos.memberships.add('g1', 'p1', '2026-06-09T00:00:00.000Z');

    expect(await repos.memberships.listMembers('g1')).toEqual(['p1']);
    expect(await repos.memberships.getJoinedAt?.('g1', 'p1')).toBe('2026-06-09T00:00:00.000Z');
  });

  it('returns null joinedAt for a non-member', async () => {
    const repos = createMemoryRepositories();
    await repos.memberships.add('g1', 'p1', '2026-06-01T00:00:00.000Z');

    expect(await repos.memberships.getJoinedAt?.('g1', 'ghost')).toBeNull();
    expect(await repos.memberships.getJoinedAt?.('other', 'p1')).toBeNull();
  });

  it('remove() and removeAll() clear membership (and its joinedAt)', async () => {
    const repos = createMemoryRepositories();
    await repos.memberships.add('g1', 'a', '2026-06-01T00:00:00.000Z');
    await repos.memberships.add('g1', 'b', '2026-06-02T00:00:00.000Z');

    await repos.memberships.remove('g1', 'a');
    expect(await repos.memberships.getJoinedAt?.('g1', 'a')).toBeNull();
    expect(await repos.memberships.listMembers('g1')).toEqual(['b']);

    await repos.memberships.removeAll('g1');
    expect(await repos.memberships.listMembers('g1')).toEqual([]);
    expect(await repos.memberships.getJoinedAt?.('g1', 'b')).toBeNull();
  });

  it('listGroups still reflects membership after the Set→Map change', async () => {
    const repos = createMemoryRepositories();
    await repos.memberships.add('g1', 'p1', '2026-06-01T00:00:00.000Z');
    await repos.memberships.add('g2', 'p1', '2026-06-02T00:00:00.000Z');
    await repos.memberships.add('g2', 'p2', '2026-06-03T00:00:00.000Z');

    expect([...(await repos.memberships.listGroups('p1'))].sort()).toEqual(['g1', 'g2']);
    expect(await repos.memberships.listGroups('p2')).toEqual(['g2']);
  });
});

describe('PlayerRepo (memory) — casing/whitespace-only rename persists', () => {
  // Mirrors the dynamo.ts FIX: a rename whose nameKey is unchanged but whose display name
  // differs (e.g. 'bob' -> 'Bob') must still be persisted, not silently no-op'd.
  it('persists a casing-only rename even though the nameKey is unchanged', async () => {
    const repos = createMemoryRepositories();
    const now = '2026-06-01T00:00:00.000Z';
    await repos.players.create({
      id: 'p1',
      name: 'bob',
      nameKey: 'bob',
      pinHash: 'h',
      tourSeenAt: null,
      createdAt: now,
      updatedAt: now,
    });

    const ok = await repos.players.rename('p1', 'Bob', 'bob');
    expect(ok).toBe(true);

    const after = await repos.players.getById('p1');
    expect(after?.name).toBe('Bob');
    expect(after?.nameKey).toBe('bob'); // unchanged key
  });
});
