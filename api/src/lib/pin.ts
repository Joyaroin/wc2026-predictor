// PIN credential handling (SECURITY-12): salted scrypt hash, timing-safe verify. PIN is never stored/logged in plaintext.
import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';

const KEYLEN = 64;

export function hashPin(pin: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(pin, salt, KEYLEN);
  return `${salt.toString('hex')}:${derived.toString('hex')}`;
}

export function verifyPin(pin: string, stored: string): boolean {
  const [saltHex, expectedHex] = stored.split(':');
  if (!saltHex || !expectedHex) return false;
  const salt = Buffer.from(saltHex, 'hex');
  const expected = Buffer.from(expectedHex, 'hex');
  const derived = scryptSync(pin, salt, expected.length);
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}
