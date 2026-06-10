// Prediction service: lock + ownership enforcement (LR, OR-2) and pre/post-lock visibility (VR).
import { computeSections, type Prediction, type BracketSide } from '@wc2026/shared';
import type { Clock } from '../lib/clock';
import type { MembershipRepo, PlayerRepo, PredictionRepo } from '../repos/types';
import type { MatchService } from './matches';
import type { MatchPredictionsView, MatchPredictionRow } from './dtos';
import { ForbiddenError, LockedError, NotFoundError } from '../lib/errors';

export interface PredictionInput {
  home: number;
  away: number;
  firstTeam?: BracketSide | null;
  firstScorerId?: string | null;
  firstScorerName?: string | null;
}

export interface PredictionService {
  upsert(callerId: string, matchId: string, input: PredictionInput): Promise<Prediction>;
  getMine(callerId: string): Promise<Prediction[]>;
  getMatchPredictions(callerId: string, groupId: string, matchId: string): Promise<MatchPredictionsView>;
  setJoker(callerId: string, matchId: string, joker: boolean): Promise<Prediction>;
}

export function createPredictionService(
  predictions: PredictionRepo,
  matchService: MatchService,
  memberships: MembershipRepo,
  players: PlayerRepo,
  clock: Clock,
): PredictionService {
  async function assertMember(callerId: string, groupId: string): Promise<void> {
    if (!(await memberships.isMember(groupId, callerId))) {
      throw new ForbiddenError('Not a member of this group');
    }
  }

  return {
    async upsert(callerId, matchId, input) {
      const match = await matchService.get(matchId);
      if (!match) throw new NotFoundError('Match not found');
      if (matchService.isLocked(match)) throw new LockedError();

      const now = clock.now().toISOString();
      const existing = await predictions.get(callerId, matchId);
      // Optional fields preserve their previous value when omitted (undefined); null clears them.
      const prediction: Prediction = {
        playerId: callerId,
        matchId,
        home: input.home,
        away: input.away,
        firstTeam: input.firstTeam !== undefined ? input.firstTeam : (existing?.firstTeam ?? null),
        firstScorerId: input.firstScorerId !== undefined ? input.firstScorerId : (existing?.firstScorerId ?? null),
        firstScorerName: input.firstScorerName !== undefined ? input.firstScorerName : (existing?.firstScorerName ?? null),
        points: existing?.points ?? 0,
        exact: existing?.exact ?? false,
        joker: existing?.joker ?? false,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      await predictions.put(prediction);
      return prediction;
    },

    getMine(callerId) {
      return predictions.listByPlayer(callerId);
    },

    async setJoker(callerId, matchId, joker) {
      const match = await matchService.get(matchId);
      if (!match) throw new NotFoundError('Match not found');
      if (matchService.isLocked(match)) throw new LockedError();
      const target = await predictions.get(callerId, matchId);
      if (!target) throw new NotFoundError('Predict the match before setting a Joker on it');

      const now = clock.now().toISOString();
      if (joker) {
        // Enforce one Joker per Fixtures section (match week / knockout round).
        const sections = computeSections(await matchService.list());
        const targetSection = sections.get(matchId);
        const mine = await predictions.listByPlayer(callerId);
        for (const p of mine) {
          if (p.matchId !== matchId && p.joker && sections.get(p.matchId) === targetSection) {
            await predictions.put({ ...p, joker: false, updatedAt: now });
          }
        }
      }
      const updated: Prediction = { ...target, joker, updatedAt: now };
      await predictions.put(updated);
      return updated;
    },

    async getMatchPredictions(callerId, groupId, matchId) {
      await assertMember(callerId, groupId);
      const match = await matchService.get(matchId);
      if (!match) throw new NotFoundError('Match not found');
      const locked = matchService.isLocked(match);
      const actual =
        match.homeScore !== null && match.awayScore !== null
          ? { home: match.homeScore, away: match.awayScore }
          : null;

      if (!locked) {
        // Pre-lock: only the caller's own prediction is visible (US-6.1).
        const own = await predictions.get(callerId, matchId);
        const me = await players.getById(callerId);
        const rows: MatchPredictionRow[] = own && me
          ? [{ playerId: callerId, name: me.name, home: own.home, away: own.away, points: own.points }]
          : [];
        return { locked, actual: null, predictions: rows };
      }

      // Post-lock: all group members' predictions.
      const memberIds = new Set(await memberships.listMembers(groupId));
      const all = await predictions.listByMatch(matchId);
      const rows: MatchPredictionRow[] = [];
      for (const p of all) {
        if (!memberIds.has(p.playerId)) continue;
        const player = await players.getById(p.playerId);
        if (!player) continue;
        rows.push({ playerId: p.playerId, name: player.name, home: p.home, away: p.away, points: p.points });
      }
      return { locked, actual, predictions: rows };
    },
  };
}
