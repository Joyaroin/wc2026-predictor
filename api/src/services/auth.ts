// Auth service: login-or-signup with name + PIN (AR-1..AR-6).
import type { Config } from '../lib/config';
import type { Clock } from '../lib/clock';
import type { PlayerRepo, PlayerRecord } from '../repos/types';
import type { AuthResult } from './dtos';
import { AuthError } from '../lib/errors';
import { hashPin, verifyPin } from '../lib/pin';
import { signSession } from '../lib/token';
import { newId } from '../lib/ids';

export interface AuthService {
  login(name: string, pin: string): Promise<AuthResult>;
}

export function nameKeyOf(name: string): string {
  return name.trim().toLowerCase();
}

export function createAuthService(players: PlayerRepo, config: Config, clock: Clock): AuthService {
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
        if (!verifyPin(pin, existing.pinHash)) throw new AuthError();
        return issue(existing);
      }
      // Sign-up: create with this name+PIN. Handle race where another request created it first.
      const now = clock.now().toISOString();
      const rec: PlayerRecord = {
        id: newId(),
        name: name.trim(),
        nameKey,
        pinHash: hashPin(pin),
        createdAt: now,
        updatedAt: now,
      };
      const created = await players.create(rec);
      if (created) return issue(rec);

      const raced = await players.getByNameKey(nameKey);
      if (!raced || !verifyPin(pin, raced.pinHash)) throw new AuthError();
      return issue(raced);
    },
  };
}
