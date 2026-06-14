// Auth service: login-or-signup with name + PIN (AR-1..AR-6).
import type { Config } from '../lib/config';
import type { Clock } from '../lib/clock';
import type { PlayerRepo, PlayerRecord } from '../repos/types';
import type { AuthResult } from './dtos';
import { AuthError, ConflictError } from '../lib/errors';
import { hashPin, verifyPin } from '../lib/pin';
import { signSession } from '../lib/token';
import { newId } from '../lib/ids';

export interface AuthService {
  login(name: string, pin: string): Promise<AuthResult>;
}

export function nameKeyOf(name: string): string {
  return name.trim().toLowerCase();
}

// Per-account PIN-guessing throttle. PINs are only 4 digits (10k keyspace) and the IP-keyed
// rate limiter does not bound guesses against a known account when an attacker rotates IPs, so
// we add a per-account (nameKey) lockout independent of source IP.
const MAX_FAILED_ATTEMPTS = 10;
const LOCKOUT_MS = 15 * 60 * 1000;

export function createAuthService(players: PlayerRepo, config: Config, clock: Clock): AuthService {
  // In-memory failure counter, keyed by nameKey. Sufficient for the single-replica deployment;
  // move to a shared/short-TTL store if the API is scaled out to multiple instances.
  const failed = new Map<string, { count: number; lockedUntil: number }>();

  const issue = (p: PlayerRecord): AuthResult => ({
    playerId: p.id,
    name: p.name,
    tourSeen: !!p.tourSeenAt,
    token: signSession(p.id, config.sessionSigningSecret, config.sessionTtlDays),
  });

  return {
    async login(name, pin) {
      const nameKey = nameKeyOf(name);
      const existing = await players.getByNameKey(nameKey);
      if (existing) {
        const now = clock.now().getTime();
        const entry = failed.get(nameKey);
        if (entry && entry.lockedUntil > now) {
          throw new AuthError('Too many failed attempts. Try again later.');
        }
        if (!(await verifyPin(pin, existing.pinHash))) {
          // Start a fresh window if a previous lockout has expired; otherwise accumulate.
          const lockoutExpired = !!entry && entry.lockedUntil > 0 && entry.lockedUntil <= now;
          const count = (!entry || lockoutExpired ? 0 : entry.count) + 1;
          failed.set(
            nameKey,
            count >= MAX_FAILED_ATTEMPTS ? { count: 0, lockedUntil: now + LOCKOUT_MS } : { count, lockedUntil: 0 },
          );
          throw new AuthError();
        }
        failed.delete(nameKey); // success clears the counter
        return issue(existing);
      }
      // A configured admin name must never be claimable via self-signup (HIGH). Only enforced
      // when an admin name is configured (empty disables name-based admin entirely).
      if (config.adminPlayer && nameKey === config.adminPlayer) {
        throw new ConflictError('Name is reserved');
      }
      // Sign-up: create with this name+PIN. Handle race where another request created it first.
      const now = clock.now().toISOString();
      const rec: PlayerRecord = {
        id: newId(),
        name: name.trim(),
        nameKey,
        pinHash: await hashPin(pin),
        createdAt: now,
        updatedAt: now,
      };
      const created = await players.create(rec);
      if (created) return issue(rec);

      const raced = await players.getByNameKey(nameKey);
      if (!raced || !(await verifyPin(pin, raced.pinHash))) throw new AuthError();
      return issue(raced);
    },
  };
}
