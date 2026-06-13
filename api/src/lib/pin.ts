// PIN credential handling (SECURITY-12): salted scrypt hash, timing-safe verify. PIN is never stored/logged in plaintext.
// scrypt is run asynchronously (promisified) so hashing does NOT block the Node event loop under load (MED).
import { scrypt, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const KEYLEN = 64;
const scryptAsync = promisify(scrypt) as (pin: string, salt: Buffer, keylen: number) => Promise<Buffer>;

export async function hashPin(pin: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scryptAsync(pin, salt, KEYLEN);
  return `${salt.toString('hex')}:${derived.toString('hex')}`;
}

export async function verifyPin(pin: string, stored: string): Promise<boolean> {
  const [saltHex, expectedHex] = stored.split(':');
  if (!saltHex || !expectedHex) return false;
  const salt = Buffer.from(saltHex, 'hex');
  const expected = Buffer.from(expectedHex, 'hex');
  // Reject a malformed/empty stored hash before deriving. We derive at a FIXED keylen (KEYLEN)
  // rather than `expected.length` so timingSafeEqual compares equal-length buffers — comparing
  // against `expected.length` would have made the old `derived.length === expected.length` guard
  // a tautology (the derived buffer was sized from `expected`).
  if (expected.length !== KEYLEN) return false;
  const derived = await scryptAsync(pin, salt, KEYLEN);
  return timingSafeEqual(derived, expected);
}
