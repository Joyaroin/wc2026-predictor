import type { PlayerRepo } from '../repos/types';
import type { PublicPlayer } from './dtos';
import { NotFoundError, ConflictError, AuthError, ValidationError, ForbiddenError } from '../lib/errors';
import { hashPin, verifyPin } from '../lib/pin';
import { nameKeyOf } from './auth';

export interface PlayerService {
  getMe(callerId: string): Promise<PublicPlayer>;
  rename(callerId: string, name: string): Promise<PublicPlayer>;
  changePin(callerId: string, currentPin: string, newPin: string): Promise<void>;
  markTourSeen(callerId: string): Promise<void>;
}

export function createPlayerService(players: PlayerRepo, adminPlayer = ''): PlayerService {
  return {
    async getMe(callerId) {
      const p = await players.getById(callerId);
      if (!p) throw new NotFoundError('Player not found');
      return { id: p.id, name: p.name, tourSeen: !!p.tourSeenAt };
    },
    async markTourSeen(callerId) {
      await players.setTourSeen(callerId, new Date().toISOString());
    },
    async rename(callerId, name) {
      const nameKey = nameKeyOf(name);
      // The configured admin name is reserved: admin status is granted by name match (feedback
      // inbox), so a free rename to it is a privilege escalation. Mirror auth.login's signup
      // reservation here — only the account that already owns the reserved nameKey may (re)claim it.
      if (adminPlayer && nameKey === adminPlayer) {
        const me = await players.getById(callerId);
        if (!me || me.nameKey !== adminPlayer) throw new ForbiddenError('Name is reserved');
      }
      const ok = await players.rename(callerId, name.trim(), nameKey);
      if (!ok) throw new ConflictError('Name is taken');
      return { id: callerId, name: name.trim() };
    },
    async changePin(callerId, currentPin, newPin) {
      // Reject a no-op change before doing any (expensive) hashing.
      if (newPin === currentPin) throw new ValidationError('New PIN must differ from the current PIN');
      const player = await players.getById(callerId);
      if (!player) throw new NotFoundError('Player not found');
      if (!(await verifyPin(currentPin, player.pinHash))) throw new AuthError('Current PIN is incorrect');
      await players.updatePin(callerId, await hashPin(newPin));
    },
  };
}
