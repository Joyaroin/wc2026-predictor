// Leaderboard service: aggregate stored points, order via shared comparator (US-5.3/5.4/5.5).
import { compareStandings, effectivePoints, computeSections, SECTION_ORDER, type StandingAgg, type Prediction, type Match } from '@wc2026/shared';
import type { Clock } from '../lib/clock';
import type { BracketRepo, GoldenBootRepo, DarkHorseRepo, TournamentWinnerRepo, PottRepo, MatchRepo, MembershipRepo, PlayerRepo, PredictionRepo } from '../repos/types';
import type { LeaderboardRow, BreakdownRow, GlobalLeaderboardView } from './dtos';
import { ForbiddenError } from '../lib/errors';

const GLOBAL_TOP = 100;

/** Build a standing aggregate: joker-adjusted score points + bracket + golden-boot bonus. */
function aggregate(playerId: string, name: string, preds: Prediction[], extraPoints: number, avatarColor?: string | null): StandingAgg {
  return {
    playerId,
    name,
    points: preds.reduce((s, p) => s + effectivePoints(p), 0) + extraPoints,
    exacts: preds.filter((p) => p.exact).length, // exact scoreline
    correctResults: preds.filter((p) => p.points >= 2).length,
    avatarColor: avatarColor ?? null,
  };
}

export interface LeaderboardService {
  getLeaderboard(callerId: string, groupId: string, scope?: 'week'): Promise<LeaderboardRow[]>;
  getBreakdown(callerId: string, groupId: string, targetPlayerId: string): Promise<BreakdownRow[]>;
  getPlayerBreakdown(callerId: string, targetPlayerId: string): Promise<BreakdownRow[]>;
  getGlobal(callerId: string): Promise<GlobalLeaderboardView>;
}

/** Match ids in the "current matchday" — first section with an unfinished match, else the last one. */
function activeSectionMatchIds(all: Match[]): Set<string> {
  const sectionById = computeSections(all);
  const present = SECTION_ORDER.filter((k) => all.some((m) => sectionById.get(m.id) === k));
  if (present.length === 0) return new Set();
  const active =
    present.find((k) => all.some((m) => sectionById.get(m.id) === k && m.status !== 'FINISHED')) ??
    present[present.length - 1];
  return new Set(all.filter((m) => sectionById.get(m.id) === active).map((m) => m.id));
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

  // A player's picks vs results. Others' picks stay hidden until each match locks (kickoff).
  async function buildBreakdown(callerId: string, targetPlayerId: string): Promise<BreakdownRow[]> {
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
  }

  return {
    async getLeaderboard(callerId, groupId, scope) {
      await assertMember(callerId, groupId);
      const memberIds = await memberships.listMembers(groupId);
      // "This matchday" view: only the current section's scorelines (season-long awards excluded).
      const weekMatchIds = scope === 'week' ? activeSectionMatchIds(await matches.listAll()) : null;
      const aggs: StandingAgg[] = [];
      for (const id of memberIds) {
        const player = await players.getById(id);
        if (!player) continue;
        let preds = await predictions.listByPlayer(id);
        let extra = 0;
        if (weekMatchIds) {
          preds = preds.filter((p) => weekMatchIds.has(p.matchId));
        } else {
          extra =
            sumPoints(await bracket.listByPlayer(id)) +
            ((await goldenBoot.get(id))?.points ?? 0) +
            ((await darkHorse.get(id))?.points ?? 0) +
            ((await tournamentWinner.get(id))?.points ?? 0) +
            ((await pott.get(id))?.points ?? 0);
        }
        aggs.push(aggregate(id, player.name, preds, extra, player.avatarColor));
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
        aggregate(p.id, nameById.get(p.id) ?? p.name, byPlayer.get(p.id) ?? [], extraByPlayer.get(p.id) ?? 0, p.avatarColor),
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
      return buildBreakdown(callerId, targetPlayerId);
    },

    async getPlayerBreakdown(callerId, targetPlayerId) {
      // Global view: any signed-in player can see anyone's *locked* (past) picks.
      return buildBreakdown(callerId, targetPlayerId);
    },
  };
}
