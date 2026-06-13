import { describe, it, expect } from 'vitest';
import { hashPin, verifyPin } from '../../src/lib/pin';

describe('pin hashing (SECURITY-12)', () => {
  it('verifies a correct PIN', async () => {
    const stored = await hashPin('1234');
    expect(await verifyPin('1234', stored)).toBe(true);
  });
  it('rejects a wrong PIN', async () => {
    const stored = await hashPin('1234');
    expect(await verifyPin('0000', stored)).toBe(false);
  });
  it('never stores the PIN in plaintext', async () => {
    const stored = await hashPin('4321');
    expect(stored).not.toContain('4321');
    expect(stored.split(':')).toHaveLength(2);
  });
  it('uses a random salt (different hashes for same PIN)', async () => {
    expect(await hashPin('1111')).not.toBe(await hashPin('1111'));
  });
  it('rejects a malformed/empty stored hash without throwing', async () => {
    expect(await verifyPin('1234', '')).toBe(false);
    expect(await verifyPin('1234', 'notahash')).toBe(false);
    // salt present but empty/short derived portion (wrong keylen) is rejected, not a tautology pass.
    const [salt] = (await hashPin('1234')).split(':');
    expect(await verifyPin('1234', `${salt}:`)).toBe(false);
    expect(await verifyPin('1234', `${salt}:abcd`)).toBe(false);
  });
});
