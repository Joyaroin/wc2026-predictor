// Scoring service: precompute & persist points when a match has a final score (SR-4 / US-5.2).
import { computePoints } from '@wc2026/shared';
import type { MatchRepo, PredictionRepo } from '../repos/types';

export interface ScoringService {
  scoreMatch(matchId: string): Promise<number>; // returns number of predictions scored
}

export function createScoringService(predictions: PredictionRepo, matches: MatchRepo): ScoringService {
  return {
    async scoreMatch(matchId) {
      const match = await matches.getById(matchId);
      if (!match || match.homeScore === null || match.awayScore === null) return 0;
      const actual = { home: match.homeScore, away: match.awayScore };
      const preds = await predictions.listByMatch(matchId);
      let scored = 0;
      for (const p of preds) {
        const points = computePoints({ home: p.home, away: p.away }, actual);
        if (points !== p.points) {
          await predictions.put({ ...p, points, updatedAt: new Date().toISOString() });
        }
        scored++;
      }
      return scored;
    },
  };
}
