// Pure scoring engine. No I/O, no clock, no randomness (BR-5).
// See aidlc-docs/construction/shared/functional-design/business-logic-model.md
import type { Score, Outcome, Points, StandingAgg, BracketSide } from './types';

/** Classify a scoreline's outcome. */
export function outcomeOf(s: Score): Outcome {
  if (s.home > s.away) return 'HOME';
  if (s.home < s.away) return 'AWAY';
  return 'DRAW';
}

/** Additive scoreline breakdown — each component scores independently. */
export interface ScoreBreakdown {
  outcome: boolean; // correct outcome (home win / draw / away win)
  goalDiff: boolean; // correct goal difference
  exact: boolean; // exact final scoreline
  home: boolean; // correct goals for team 1 (home)
  away: boolean; // correct goals for team 2 (away)
  points: number;
}

export const SCORE_POINTS = {
  outcome: 2,
  goalDiff: 3,
  exact: 3,
  home: 2,
  away: 2,
} as const;

/** Highest possible scoreline points (a perfect exact score). First team/player to score add up to +8 more. */
export const MAX_SCORELINE_POINTS = SCORE_POINTS.outcome + SCORE_POINTS.goalDiff + SCORE_POINTS.exact + SCORE_POINTS.home + SCORE_POINTS.away; // 12

/** Bonus for correctly predicting the first team to score / the first goalscorer. */
export const FIRST_TEAM_POINTS = 2;
export const FIRST_PLAYER_POINTS = 6;

/** Additive points for a scoreline prediction vs the actual full-time score. */
export function scoreBreakdown(prediction: Score, actual: Score): ScoreBreakdown {
  const outcome = outcomeOf(prediction) === outcomeOf(actual);
  const goalDiff = prediction.home - prediction.away === actual.home - actual.away;
  const home = prediction.home === actual.home;
  const away = prediction.away === actual.away;
  const exact = home && away;
  const points =
    (outcome ? SCORE_POINTS.outcome : 0) +
    (goalDiff ? SCORE_POINTS.goalDiff : 0) +
    (exact ? SCORE_POINTS.exact : 0) +
    (home ? SCORE_POINTS.home : 0) +
    (away ? SCORE_POINTS.away : 0);
  return { outcome, goalDiff, exact, home, away, points };
}

export function computePoints(prediction: Score, actual: Score): Points {
  return scoreBreakdown(prediction, actual).points;
}

export interface FirstGoalFacts {
  firstGoalTeam?: BracketSide | 'NONE' | null;
  firstScorerId?: string | null;
}
export interface FirstGoalPrediction {
  home: number;
  away: number;
  firstTeam?: BracketSide | null;
  firstScorerId?: string | null;
}

/**
 * First-team-to-score (+2) and first-player-to-score (+6) points.
 * A goalless game has no first scorer, so a correctly-predicted 0-0 earns BOTH bonuses
 * (you called "nobody scores"). For 0-0 this is derived from the score itself — no ESPN needed.
 */
export function firstGoalPoints(pred: FirstGoalPrediction, actual: Score, facts: FirstGoalFacts): { firstTeam: number; firstPlayer: number } {
  if (actual.home === 0 && actual.away === 0) {
    const calledIt = pred.home === 0 && pred.away === 0;
    return { firstTeam: calledIt ? FIRST_TEAM_POINTS : 0, firstPlayer: calledIt ? FIRST_PLAYER_POINTS : 0 };
  }
  const firstTeam =
    pred.firstTeam && facts.firstGoalTeam && facts.firstGoalTeam !== 'NONE' && pred.firstTeam === facts.firstGoalTeam
      ? FIRST_TEAM_POINTS
      : 0;
  const firstPlayer = pred.firstScorerId && facts.firstScorerId && pred.firstScorerId === facts.firstScorerId ? FIRST_PLAYER_POINTS : 0;
  return { firstTeam, firstPlayer };
}

/**
 * First-goal bonus to actually count, given whether the match is FINISHED.
 *
 * `fg` is the result of `firstGoalPoints` (firstTeam + firstPlayer). A 0-0 awards the full bonus
 * because "nobody scores" was called — but while the match is still LIVE a 0-0 is provisional, so
 * the goalless auto-bonus must NOT be paid yet (a single goal removes it). It counts only once
 * FINISHED. A real first goal that already happened (non-goalless) is final, so it counts live too.
 *
 * Used by BOTH the server (scoreMatch persists points) and the web (live points bubble) so the
 * leaderboard, My Points, and the fixture card all agree on a live 0-0.
 */
export function liveFirstGoalBonus(
  fg: { firstTeam: number; firstPlayer: number } | null,
  opts: { finished: boolean; goalless: boolean },
): number {
  if (!fg) return 0;
  if (!opts.finished && opts.goalless) return 0;
  return fg.firstTeam + fg.firstPlayer;
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
