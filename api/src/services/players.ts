import type { PlayerRepo } from '../repos/types';
import type { PublicPlayer } from './dtos';
import { NotFoundError, ConflictError, AuthError } from '../lib/errors';
import { hashPin, verifyPin } from '../lib/pin';
import { nameKeyOf } from './auth';

export interface PlayerService {
  getMe(callerId: string): Promise<PublicPlayer>;
  rename(callerId: string, name: string): Promise<PublicPlayer>;
  changePin(callerId: string, currentPin: string, newPin: string): Promise<void>;
  markTourSeen(callerId: string): Promise<void>;
  setAvatarColor(callerId: string, color: string | null): Promise<PublicPlayer>;
}

export function createPlayerService(players: PlayerRepo): PlayerService {
  async function publicOf(callerId: string): Promise<PublicPlayer> {
    const p = await players.getById(callerId);
    if (!p) throw new NotFoundError('Player not found');
    return { id: p.id, name: p.name, tourSeen: !!p.tourSeenAt, avatarColor: p.avatarColor ?? null, createdAt: p.createdAt };
  }
  return {
    async getMe(callerId) {
      return publicOf(callerId);
    },
    async setAvatarColor(callerId, color) {
      await players.setAvatarColor(callerId, color);
      return publicOf(callerId);
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
      const player = await players.getById(callerId);
      if (!player) throw new NotFoundError('Player not found');
      if (!verifyPin(currentPin, player.pinHash)) throw new AuthError('Current PIN is incorrect');
      await players.updatePin(callerId, hashPin(newPin));
    },
  };
}
