// Bracket service: predict who advances from a knockout match (one pick per match).
import type { BracketPick, BracketSide } from '@wc2026/shared';
import type { Clock } from '../lib/clock';
import type { BracketRepo } from '../repos/types';
import type { MatchService } from './matches';
import { LockedError, NotFoundError, ValidationError } from '../lib/errors';

export interface BracketService {
  setPick(callerId: string, matchId: string, side: BracketSide): Promise<BracketPick>;
  getMine(callerId: string): Promise<BracketPick[]>;
}

export function createBracketService(
  bracket: BracketRepo,
  matchService: MatchService,
  clock: Clock,
): BracketService {
  return {
    async setPick(callerId, matchId, side) {
      const match = await matchService.get(matchId);
      if (!match) throw new NotFoundError('Match not found');
      if (match.stage === 'GROUP_STAGE') throw new ValidationError('Bracket picks are for knockout matches only');
      if (match.placeholder) throw new ValidationError('Teams for this match are not decided yet');
      if (matchService.isLocked(match)) throw new LockedError();

      const now = clock.now().toISOString();
      const existing = await bracket.get(callerId, matchId);
      const pick: BracketPick = {
        playerId: callerId,
        matchId,
        side,
        teamName: side === 'HOME' ? match.homeTeam : match.awayTeam,
        points: existing?.points ?? 0,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      await bracket.put(pick);
      return pick;
    },

    getMine(callerId) {
      return bracket.listByPlayer(callerId);
    },
  };
}
