// Leaderboard service: aggregate stored points, order via shared comparator (US-5.3/5.4/5.5).
import { compareStandings, type StandingAgg } from '@wc2026/shared';
import type { Clock } from '../lib/clock';
import type { MatchRepo, MembershipRepo, PlayerRepo, PredictionRepo } from '../repos/types';
import type { LeaderboardRow, BreakdownRow } from './dtos';
import { ForbiddenError } from '../lib/errors';

export interface LeaderboardService {
  getLeaderboard(callerId: string, groupId: string): Promise<LeaderboardRow[]>;
  getBreakdown(callerId: string, groupId: string, targetPlayerId: string): Promise<BreakdownRow[]>;
}

export function createLeaderboardService(
  predictions: PredictionRepo,
  memberships: MembershipRepo,
  players: PlayerRepo,
  matches: MatchRepo,
  clock: Clock,
): LeaderboardService {
  async function assertMember(callerId: string, groupId: string): Promise<void> {
    if (!(await memberships.isMember(groupId, callerId))) {
      throw new ForbiddenError('Not a member of this group');
    }
  }

  return {
    async getLeaderboard(callerId, groupId) {
      await assertMember(callerId, groupId);
      const memberIds = await memberships.listMembers(groupId);
      const aggs: StandingAgg[] = [];
      for (const id of memberIds) {
        const player = await players.getById(id);
        if (!player) continue;
        const preds = await predictions.listByPlayer(id);
        const agg: StandingAgg = {
          playerId: id,
          name: player.name,
          points: preds.reduce((s, p) => s + p.points, 0),
          exacts: preds.filter((p) => p.points === 5).length,
          correctResults: preds.filter((p) => p.points >= 2).length,
        };
        aggs.push(agg);
      }
      aggs.sort(compareStandings);
      return aggs.map((a, i) => ({ rank: i + 1, ...a }));
    },

    async getBreakdown(callerId, groupId, targetPlayerId) {
      await assertMember(callerId, groupId);
      if (!(await memberships.isMember(groupId, targetPlayerId))) {
        throw new ForbiddenError('Target is not a member of this group');
      }
      const now = clock.now().getTime();
      const all = await matches.listAll();
      const preds = new Map((await predictions.listByPlayer(targetPlayerId)).map((p) => [p.matchId, p]));
      const rows: BreakdownRow[] = [];
      for (const m of all) {
        const pred = preds.get(m.id);
        if (!pred) continue;
        const locked = now >= new Date(m.kickoff).getTime();
        const hide = !locked && targetPlayerId !== callerId; // VR: don't reveal others' picks pre-lock
        rows.push({
          matchId: m.id,
          home: hide ? null : pred.home,
          away: hide ? null : pred.away,
          actualHome: m.homeScore,
          actualAway: m.awayScore,
          points: pred.points,
          locked,
        });
      }
      return rows;
    },
  };
}
