// Leaderboard service: aggregate stored points, order via shared comparator (US-5.3/5.4/5.5).
import { compareStandings, effectivePoints, type StandingAgg, type Prediction } from '@wc2026/shared';
import type { Clock } from '../lib/clock';
import type { MatchRepo, MembershipRepo, PlayerRepo, PredictionRepo } from '../repos/types';
import type { LeaderboardRow, BreakdownRow, GlobalLeaderboardView } from './dtos';
import { ForbiddenError } from '../lib/errors';

const GLOBAL_TOP = 100;

/** Build a standing aggregate from a player's predictions (joker-adjusted points). */
function aggregate(playerId: string, name: string, preds: Prediction[]): StandingAgg {
  return {
    playerId,
    name,
    points: preds.reduce((s, p) => s + effectivePoints(p), 0),
    exacts: preds.filter((p) => p.points === 5).length,
    correctResults: preds.filter((p) => p.points >= 2).length,
  };
}

export interface LeaderboardService {
  getLeaderboard(callerId: string, groupId: string): Promise<LeaderboardRow[]>;
  getBreakdown(callerId: string, groupId: string, targetPlayerId: string): Promise<BreakdownRow[]>;
  getGlobal(callerId: string): Promise<GlobalLeaderboardView>;
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
        aggs.push(aggregate(id, player.name, await predictions.listByPlayer(id)));
      }
      aggs.sort(compareStandings);
      return aggs.map((a, i) => ({ rank: i + 1, ...a }));
    },

    async getGlobal(callerId) {
      // Aggregate every player's predictions in one pass (scan), then rank.
      const allPlayers = await players.listAll();
      const nameById = new Map(allPlayers.map((p) => [p.id, p.name]));
      const byPlayer = new Map<string, Prediction[]>();
      for (const pred of await predictions.scanAll()) {
        const list = byPlayer.get(pred.playerId) ?? [];
        list.push(pred);
        byPlayer.set(pred.playerId, list);
      }
      const aggs: StandingAgg[] = allPlayers.map((p) =>
        aggregate(p.id, nameById.get(p.id) ?? p.name, byPlayer.get(p.id) ?? []),
      );
      aggs.sort(compareStandings);
      const ranked: LeaderboardRow[] = aggs.map((a, i) => ({ rank: i + 1, ...a }));
      const me = ranked.find((r) => r.playerId === callerId) ?? null;
      return { total: ranked.length, top: ranked.slice(0, GLOBAL_TOP), me };
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
