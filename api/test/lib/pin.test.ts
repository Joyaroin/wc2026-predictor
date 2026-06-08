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
    expect(stored).not.toContain('4321');
    expect(stored.split(':')).toHaveLength(2);
  });
  it('uses a random salt (different hashes for same PIN)', () => {
    expect(hashPin('1111')).not.toBe(hashPin('1111'));
  });
});
