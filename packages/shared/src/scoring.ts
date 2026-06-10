// Pure scoring engine. No I/O, no clock, no randomness (BR-5).
// See aidlc-docs/construction/shared/functional-design/business-logic-model.md
import type { Score, Outcome, Points, StandingAgg } from './types';

/** BR-1.5 — classify a scoreline's outcome. */
export function outcomeOf(s: Score): Outcome {
  if (s.home > s.away) return 'HOME';
  if (s.home < s.away) return 'AWAY';
  return 'DRAW';
}

/**
 * BR-1 — points for a prediction against the actual full-time score.
 *   exact = 5, correct goal difference = 3, correct result = 2, wrong = 0.
 * @param prediction the player's predicted scoreline
 * @param actual the actual full-time scoreline (must be a complete score)
 */
export function computePoints(prediction: Score, actual: Score): Points {
  if (prediction.home === actual.home && prediction.away === actual.away) {
    return 5; // BR-1.1 exact
  }
  if (outcomeOf(prediction) !== outcomeOf(actual)) {
    return 0; // BR-1.4 wrong outcome
  }
  if (prediction.home - prediction.away === actual.home - actual.away) {
    return 3; // BR-1.2 same outcome + same goal difference
  }
  return 2; // BR-1.3 correct outcome only
}

/** Points after applying the Joker multiplier (doubles when joker is set). */
export function effectivePoints(p: { points: number; joker?: boolean }): number {
  return p.joker ? p.points * 2 : p.points;
}

/**
 * BR-3 — total ordering for leaderboard standings (use with Array.prototype.sort).
 * Returns < 0 if `a` ranks before `b`.
 * Order: points desc → exacts desc → correctResults desc → name asc (case-insensitive).
 */
export function compareStandings(a: StandingAgg, b: StandingAgg): number {
  if (a.points !== b.points) return b.points - a.points;
  if (a.exacts !== b.exacts) return b.exacts - a.exacts;
  if (a.correctResults !== b.correctResults) return b.correctResults - a.correctResults;
  const an = a.name.toLowerCase();
  const bn = b.name.toLowerCase();
  if (an < bn) return -1;
  if (an > bn) return 1;
  return 0;
}
