// Stateless signed session token (SECURITY-12): base64url(payload).hmacSig, with expiry.
import { createHmac, timingSafeEqual } from 'node:crypto';

interface Payload {
  sub: string; // player id
  iat: number;
  exp: number;
}

const b64url = (buf: Buffer): string => buf.toString('base64url');

function sign(payloadB64: string, secret: string): string {
  return b64url(createHmac('sha256', secret).update(payloadB64).digest());
}

export function signSession(playerId: string, secret: string, ttlDays: number): string {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + Math.round(ttlDays * 86400);
  const payload: Payload = { sub: playerId, iat, exp };
  const payloadB64 = b64url(Buffer.from(JSON.stringify(payload)));
  return `${payloadB64}.${sign(payloadB64, secret)}`;
}

/** Returns the player id if the token is valid and unexpired, else null. */
export function verifySession(token: string, secret: string): string | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payloadB64, sig] = parts;
  if (!payloadB64 || !sig) return null;

  const expected = sign(payloadB64, secret);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString()) as Payload;
    if (typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) return null;
    // Require a non-empty subject: an empty/whitespace id must never be treated as a valid principal.
    return typeof payload.sub === 'string' && payload.sub.length > 0 ? payload.sub : null;
  } catch {
    return null;
  }
}
