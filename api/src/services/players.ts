import type { PlayerRepo } from '../repos/types';
import type { PublicPlayer } from './dtos';
import { NotFoundError, ConflictError, AuthError, ValidationError } from '../lib/errors';
import { hashPin, verifyPin } from '../lib/pin';
import { nameKeyOf } from './auth';

export interface PlayerService {
  getMe(callerId: string): Promise<PublicPlayer>;
  rename(callerId: string, name: string): Promise<PublicPlayer>;
  changePin(callerId: string, currentPin: string, newPin: string): Promise<void>;
  markTourSeen(callerId: string): Promise<void>;
}

export function createPlayerService(players: PlayerRepo): PlayerService {
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
      const ok = await players.rename(callerId, name.trim(), nameKeyOf(name));
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
