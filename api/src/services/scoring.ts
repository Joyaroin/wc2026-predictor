// Scoring service: precompute & persist points when a match is decided (SR-4 / US-5.2).
// Scores both score-predictions and knockout bracket (advancement) picks.
import { computePoints, darkHorsePoints } from '@wc2026/shared';
import type { BracketRepo, MatchRepo, PredictionRepo } from '../repos/types';

export interface ScoringService {
  scoreMatch(matchId: string): Promise<number>; // returns number of score-predictions scored
}

export function createScoringService(
  predictions: PredictionRepo,
  matches: MatchRepo,
  bracket: BracketRepo,
): ScoringService {
  return {
    async scoreMatch(matchId) {
      const match = await matches.getById(matchId);
      if (!match || match.homeScore === null || match.awayScore === null) return 0;
      const actual = { home: match.homeScore, away: match.awayScore };
      const now = new Date().toISOString();

      // Score-prediction points.
      const preds = await predictions.listByMatch(matchId);
      let scored = 0;
      for (const p of preds) {
        const points = computePoints({ home: p.home, away: p.away }, actual);
        if (points !== p.points) await predictions.put({ ...p, points, updatedAt: now });
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
  };
}
