// Pure scoring engine. No I/O, no clock, no randomness (BR-5).
// See aidlc-docs/construction/shared/functional-design/business-logic-model.md
import type { Score, Outcome, Points, StandingAgg, BracketSide, Stage } from './types';

/** Classify a scoreline's outcome. */
export function outcomeOf(s: Score): Outcome {
  if (s.home > s.away) return 'HOME';
  if (s.home < s.away) return 'AWAY';
  return 'DRAW';
}

/** Additive scoreline breakdown — each component scores independently. */
export interface ScoreBreakdown {
  outcome: boolean; // correct win/draw/win
  goalDiff: boolean; // correct goal margin (regardless of which team won)
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
  // Goal margin counts whether you predicted a win or a loss (|home-away| matches).
  const goalDiff = Math.abs(prediction.home - prediction.away) === Math.abs(actual.home - actual.away);
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

/** Bonus for correctly calling the penalty-shootout winner on a knockout draw prediction. */
export const PEN_WINNER_POINTS = 5;

/**
 * +5 only when: the match went to pens (knockout, level full-time score, a HOME/AWAY winner),
 * the player predicted a draw, and their penWinner matches the actual shootout winner.
 * A decisive prediction (e.g. 2-0) never qualifies — so it earns no pen bonus even if that
 * team wins the shootout (and existing scoreline scoring already denies it the outcome point).
 */
export function penaltyWinnerPoints(
  pred: { home: number; away: number; penWinner?: BracketSide | null },
  match: { stage: Stage; homeScore: number | null; awayScore: number | null; winner?: Outcome | null },
): number {
  const wentToPens =
    match.stage !== 'GROUP_STAGE' &&
    match.homeScore != null &&
    match.awayScore != null &&
    match.homeScore === match.awayScore &&
    (match.winner === 'HOME' || match.winner === 'AWAY');
  const predictedDraw = pred.home === pred.away;
  return wentToPens && predictedDraw && pred.penWinner != null && pred.penWinner === match.winner
    ? PEN_WINNER_POINTS
    : 0;
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
