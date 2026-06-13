// Constant-time string comparison for secrets (admin tokens, etc.).
// Avoids the byte-by-byte short-circuit of `a === b`, which leaks a timing oracle
// that can be used to recover a secret one character at a time.
import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * Returns true iff `a` and `b` are equal, in time independent of where they first differ.
 * Both inputs are SHA-256 hashed first so the comparison runs over equal-length buffers
 * regardless of the raw input lengths (length differences would otherwise leak via timing/throw).
 * An empty configured secret always returns false (never authorize against an unset secret).
 */
export function secureEquals(a: string, b: string): boolean {
  if (!a || !b) return false;
  const ah = createHash('sha256').update(a).digest();
  const bh = createHash('sha256').update(b).digest();
  return timingSafeEqual(ah, bh);
}
