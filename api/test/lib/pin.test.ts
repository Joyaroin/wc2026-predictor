import { describe, it, expect } from 'vitest';
import { hashPin, verifyPin } from '../../src/lib/pin';

describe('pin hashing (SECURITY-12)', () => {
  it('verifies a correct PIN', () => {
    const stored = hashPin('1234');
    expect(verifyPin('1234', stored)).toBe(true);
  });
  it('rejects a wrong PIN', () => {
    const stored = hashPin('1234');
    expect(verifyPin('0000', stored)).toBe(false);
  });
  it('never stores the PIN in plaintext', () => {
    const stored = hashPin('4321');
    // Both parts are long hex strings (salt:hash) — a digit PIN can legitimately
    // appear as a substring of random hex, so assert the format, not absence.
    expect(stored).toMatch(/^[0-9a-f]{16,}:[0-9a-f]{64,}$/);
    const [salt, hash] = stored.split(':');
    expect(salt).not.toBe('4321');
    expect(hash).not.toBe('4321');
  });
  it('uses a random salt (different hashes for same PIN)', () => {
    expect(hashPin('1111')).not.toBe(hashPin('1111'));
  });
});
