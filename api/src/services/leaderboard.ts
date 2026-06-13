// Leaderboard service: aggregate stored points, order via shared comparator (US-5.3/5.4/5.5).
import { compareStandings, effectivePoints, type StandingAgg, type Prediction } from '@wc2026/shared';
import type { Clock } from '../lib/clock';
import type { BracketRepo, GoldenBootRepo, DarkHorseRepo, TournamentWinnerRepo, PottRepo, MatchRepo, MembershipRepo, PlayerRepo, PredictionRepo } from '../repos/types';
import type { LeaderboardRow, BreakdownRow, GlobalLeaderboardView } from './dtos';
import { ForbiddenError } from '../lib/errors';

const GLOBAL_TOP = 100;

/** Build a standing aggregate: joker-adjusted score points + bracket + golden-boot bonus. */
function aggregate(playerId: string, name: string, preds: Prediction[], extraPoints: number): StandingAgg {
  return {
    playerId,
    name,
    points: preds.reduce((s, p) => s + effectivePoints(p), 0) + extraPoints,
    exacts: preds.filter((p) => p.exact).length, // exact scoreline
    // Correct W/D/L outcome — NOT `points >= 2`, since a wrong-outcome prediction can score 2
    // by matching only the home- or away-goal count. Uses the persisted `correctOutcome` flag.
    correctResults: preds.filter((p) => p.correctOutcome).length,
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
  bracket: BracketRepo,
  goldenBoot: GoldenBootRepo,
  darkHorse: DarkHorseRepo,
  tournamentWinner: TournamentWinnerRepo,
  pott: PottRepo,
  clock: Clock,
): LeaderboardService {
  const sumPoints = (picks: { points: number }[]): number => picks.reduce((s, b) => s + b.points, 0);
  async function assertMember(callerId: string, groupId: string): Promise<void> {
    if (!(await memberships.isMember(groupId, callerId))) {
      throw new ForbiddenError('Not a member of this group');
    }
  }

  // Short-TTL cache for the global view. getGlobal does ~7 full-table scans per call with no
  // per-caller variation in the ranked aggregate (it is global), so an authenticated caller could
  // hammer the endpoint to amplify scan load (cheap DoS). We cache the computed ranked list for a
  // few seconds and derive each caller's own `me` row from it, so every caller still sees their own
  // rank. Invalidate-by-TTL is sufficient — stale-by-seconds is acceptable for a leaderboard.
  const GLOBAL_CACHE_TTL_MS = 30_000;
  let globalCache: { at: number; ranked: LeaderboardRow[] } | null = null;

  return {
    async getLeaderboard(callerId, groupId) {
      await assertMember(callerId, groupId);
      const memberIds = await memberships.listMembers(groupId);
      // Parallelize across members (was N+1 sequential awaits per member). Within each member the
      // independent award/get calls also run together. Ordering is irrelevant pre-sort —
      // compareStandings below establishes the final order.
      const aggs = (
        await Promise.all(
          memberIds.map(async (id) => {
            const [player, brackets, gb, dh, tw, po, preds] = await Promise.all([
              players.getById(id),
              bracket.listByPlayer(id),
              goldenBoot.get(id),
              darkHorse.get(id),
              tournamentWinner.get(id),
              pott.get(id),
              predictions.listByPlayer(id),
            ]);
            if (!player) return null;
            const extra =
              sumPoints(brackets) +
              (gb?.points ?? 0) +
              (dh?.points ?? 0) +
              (tw?.points ?? 0) +
              (po?.points ?? 0);
            return aggregate(id, player.name, preds, extra);
          }),
        )
      ).filter((a): a is StandingAgg => a !== null);
      aggs.sort(compareStandings);
      return aggs.map((a, i) => ({ rank: i + 1, ...a }));
    },

    async getGlobal(callerId) {
      // Serve the ranked aggregate from cache when fresh; only `me` is computed per-caller.
      const cached = globalCache;
      if (cached && clock.now().getTime() - cached.at < GLOBAL_CACHE_TTL_MS) {
        const me = cached.ranked.find((r) => r.playerId === callerId) ?? null;
        return { total: cached.ranked.length, top: cached.ranked.slice(0, GLOBAL_TOP), me };
      }
      // Aggregate every player's predictions in one pass (scan), then rank.
      const allPlayers = await players.listAll();
      const nameById = new Map(allPlayers.map((p) => [p.id, p.name]));
      const byPlayer = new Map<string, Prediction[]>();
      for (const pred of await predictions.scanAll()) {
        const list = byPlayer.get(pred.playerId) ?? [];
        list.push(pred);
        byPlayer.set(pred.playerId, list);
      }
      const extraByPlayer = new Map<string, number>();
      for (const b of await bracket.scanAll()) {
        extraByPlayer.set(b.playerId, (extraByPlayer.get(b.playerId) ?? 0) + b.points);
      }
      for (const g of await goldenBoot.scanAll()) {
        extraByPlayer.set(g.playerId, (extraByPlayer.get(g.playerId) ?? 0) + g.points);
      }
      for (const d of await darkHorse.scanAll()) {
        extraByPlayer.set(d.playerId, (extraByPlayer.get(d.playerId) ?? 0) + d.points);
      }
      for (const w of await tournamentWinner.scanAll()) {
        extraByPlayer.set(w.playerId, (extraByPlayer.get(w.playerId) ?? 0) + w.points);
      }
      for (const p of await pott.scanAll()) {
        extraByPlayer.set(p.playerId, (extraByPlayer.get(p.playerId) ?? 0) + p.points);
      }
      const aggs: StandingAgg[] = allPlayers.map((p) =>
        aggregate(p.id, nameById.get(p.id) ?? p.name, byPlayer.get(p.id) ?? [], extraByPlayer.get(p.id) ?? 0),
      );
      aggs.sort(compareStandings);
      const ranked: LeaderboardRow[] = aggs.map((a, i) => ({ rank: i + 1, ...a }));
      globalCache = { at: clock.now().getTime(), ranked };
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
