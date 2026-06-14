import { describe, it, expect } from 'vitest';
import { createMemoryRepositories } from '../../src/repos/memory';
import { createAuthService } from '../../src/services/auth';
import { fixedClock } from '../../src/lib/clock';
import { AuthError } from '../../src/lib/errors';
import { testConfig, seedPlayer } from '../support/testApp';

const AT = new Date('2026-06-14T00:00:00.000Z');

describe('AuthService.login — per-account PIN lockout', () => {
  it('locks an account after too many failed PIN attempts, regardless of source IP', async () => {
    const repos = createMemoryRepositories();
    await seedPlayer(repos, 'Bob', '1234');
    const auth = createAuthService(repos.players, testConfig, fixedClock(AT));

    for (let i = 0; i < 10; i++) {
      await expect(auth.login('Bob', '0000')).rejects.toBeInstanceOf(AuthError);
    }
    // Now locked: even the CORRECT PIN is refused during the lockout window.
    await expect(auth.login('Bob', '1234')).rejects.toThrow(/too many/i);
  });

  it('clears the failure counter on a successful login', async () => {
    const repos = createMemoryRepositories();
    await seedPlayer(repos, 'Bob', '1234');
    const auth = createAuthService(repos.players, testConfig, fixedClock(AT));

    for (let i = 0; i < 9; i++) {
      await expect(auth.login('Bob', '0000')).rejects.toBeInstanceOf(AuthError);
    }
    expect((await auth.login('Bob', '1234')).name).toBe('Bob'); // success resets the counter
    // A fresh run of failures does not immediately re-lock (counter was cleared).
    await expect(auth.login('Bob', '0000')).rejects.toBeInstanceOf(AuthError);
    expect((await auth.login('Bob', '1234')).name).toBe('Bob');
  });
});
