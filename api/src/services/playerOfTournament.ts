// Player of the Tournament award: pick a footballer; +25 if they win. The official winner has no
// free data source, so an admin sets it (gated by ADMIN_TOKEN) at the end of the tournament.
import { awardsLocked } from '@wc2026/shared';
import type { Clock } from '../lib/clock';
import type { PottRepo, StatsRepo, PottPick, Winner } from '../repos/types';
import type { MatchService } from './matches';
import { ForbiddenError, LockedError, ValidationError } from '../lib/errors';

export const POTT_BONUS = 25;

export interface PottStatus {
  pick: { winnerId: string; winnerName: string; points: number } | null;
  winner: Winner | null; // admin-set actual winner
  locked: boolean;
}

export interface PottService {
  getStatus(callerId: string): Promise<PottStatus>;
  setPick(callerId: string, winnerId: string, winnerName: string): Promise<PottPick>;
  /** Admin-only: set the official winner and score all picks. */
  setWinner(token: string | undefined, winnerId: string, winnerName: string): Promise<Winner>;
}

export function createPottService(
  pott: PottRepo,
  stats: StatsRepo,
  matchService: MatchService,
  clock: Clock,
  adminToken: string,
): PottService {
  async function isLocked(): Promise<boolean> {
    return awardsLocked(clock.now());
  }

  return {
    async getStatus(callerId) {
      const [pick, winner, locked] = await Promise.all([pott.get(callerId), stats.getPottWinner(), isLocked()]);
      return {
        pick: pick ? { winnerId: pick.winnerId, winnerName: pick.winnerName, points: pick.points } : null,
        winner,
        locked,
      };
    },

    async setPick(callerId, winnerId, winnerName) {
      if (!winnerId.trim() || !winnerName.trim()) throw new ValidationError('Pick a player');
      if (await isLocked()) throw new LockedError();

      const now = clock.now().toISOString();
      const existing = await pott.get(callerId);
      const pick: PottPick = {
        playerId: callerId,
        winnerId: winnerId.trim(),
        winnerName: winnerName.trim(),
        points: existing?.points ?? 0,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      await pott.put(pick);
      return pick;
    },

    async setWinner(token, winnerId, winnerName) {
      if (!adminToken || token !== adminToken) throw new ForbiddenError('Admin token required');
      if (!winnerId.trim() || !winnerName.trim()) throw new ValidationError('winnerId and winnerName required');

      const winner: Winner = { id: winnerId.trim(), name: winnerName.trim() };
      await stats.setPottWinner(winner);
      const now = clock.now().toISOString();
      for (const pick of await pott.scanAll()) {
        const pts = pick.winnerId === winner.id ? POTT_BONUS : 0;
        if (pts !== pick.points) await pott.put({ ...pick, points: pts, updatedAt: now });
      }
      return winner;
    },
  };
}
