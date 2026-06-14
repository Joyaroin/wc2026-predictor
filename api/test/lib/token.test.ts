import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { signSession, verifySession } from '../../src/lib/token';

const SECRET = 'unit-test-secret';

describe('session token (SECURITY-12, PBT-02 round-trip)', () => {
  it('round-trips the player id', () => {
    fc.assert(
      fc.property(fc.uuid(), (id) => {
        const token = signSession(id, SECRET, 30);
        expect(verifySession(token, SECRET)).toBe(id);
      }),
    );
  });

  it('rejects a tampered payload', () => {
    const token = signSession('player-1', SECRET, 30);
    const [, sig] = token.split('.');
    const forged = `${Buffer.from(JSON.stringify({ sub: 'attacker', iat: 0, exp: 9999999999 })).toString('base64url')}.${sig}`;
    expect(verifySession(forged, SECRET)).toBeNull();
  });

  it('rejects a wrong signing key', () => {
    const token = signSession('player-1', SECRET, 30);
    expect(verifySession(token, 'other-secret')).toBeNull();
  });

  it('rejects an expired token', () => {
    const token = signSession('player-1', SECRET, -1); // already expired
    expect(verifySession(token, SECRET)).toBeNull();
  });

  it('rejects a validly-signed token with an empty subject', () => {
    // signSession never emits this today, but a malformed/future signer could; an empty callerId
    // must not be accepted as an authenticated principal.
    const token = signSession('', SECRET, 30);
    expect(verifySession(token, SECRET)).toBeNull();
  });
});
