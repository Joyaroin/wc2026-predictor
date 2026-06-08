import { randomUUID, randomInt } from 'node:crypto';

export const newId = (): string => randomUUID();

// Invite code: 8 chars from an unambiguous base-32 alphabet (no 0/O/1/I) — CSPRNG (SECURITY-11).
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function newInviteCode(): string {
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += ALPHABET[randomInt(ALPHABET.length)];
  }
  return code;
}
