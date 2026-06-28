// Scoring service: precompute & persist points when a match is decided (SR-4 / US-5.2).
// Scores both score-predictions and knockout bracket (advancement) picks.
import { scoreBreakdown, firstGoalPoints, darkHorsePoints, penaltyWinnerPoints } from '@wc2026/shared';
import type { BracketRepo, MatchRepo, PredictionRepo } from '../repos/types';

export interface ScoringService {
  scoreMatch(matchId: string): Promise<number>; // returns number of score-predictions scored
  /** Re-score every match that has a final score (e.g. after a scoring-rule change). */
  rescoreAll(): Promise<number>;
}

export function createScoringService(
  predictions: PredictionRepo,
  matches: MatchRepo,
  bracket: BracketRepo,
): ScoringService {
  const svc = {
    async scoreMatch(matchId: string) {
      const match = await matches.getById(matchId);
      if (!match || match.homeScore === null || match.awayScore === null) return 0;
      const actual = { home: match.homeScore, away: match.awayScore };
      const now = new Date().toISOString();

      // Score-prediction points: scoreline + first-team (+2) + first-player (+6).
      // First-goal facts come from a separate ESPN ingestion; absent until then (no bonus yet).
      const preds = await predictions.listByMatch(matchId);
      let scored = 0;
      for (const p of preds) {
        const bd = scoreBreakdown({ home: p.home, away: p.away }, actual);
        // First-team/first-player bonuses — a correctly-called 0-0 earns both (no first scorer exists).
        const fg = firstGoalPoints(p, actual, { firstGoalTeam: match.firstGoalTeam, firstScorerId: match.firstScorerId });
        const pen = penaltyWinnerPoints(p, match);
        const points = bd.points + fg.firstTeam + fg.firstPlayer + pen;
        if (points !== p.points || bd.exact !== p.exact) {
          await predictions.put({ ...p, points, exact: bd.exact, updatedAt: now });
        }
        scored++;
      }

      // Knockout bracket (advancement) points — Dark Horse: backing a longer shot pays more.
      if (match.stage !== 'GROUP_STAGE' && (match.winner === 'HOME' || match.winner === 'AWAY')) {
        const advancerCode = match.winner === 'HOME' ? match.homeCode : match.awayCode;
        const reward = darkHorsePoints(match.stage, advancerCode);
        for (const pick of await bracket.listByMatch(matchId)) {
          const pts = pick.side === match.winner ? reward : 0;
          if (pts !== pick.points) await bracket.put({ ...pick, points: pts, updatedAt: now });
        }
      }

      return scored;
    },

    async rescoreAll() {
      let total = 0;
      for (const m of await matches.listAll()) {
        if (m.homeScore !== null && m.awayScore !== null) total += await svc.scoreMatch(m.id);
      }
      return total;
    },
  };
  return svc;
}
