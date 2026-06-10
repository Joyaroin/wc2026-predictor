// "Dark Horse" bracket scoring: correctly backing an underdog to advance pays more.
import type { Stage } from './types';

/** Pre-tournament title win-probability (%) by FIFA team code. */
export const WIN_PROBABILITY: Record<string, number> = {
  FRA: 18.6, ESP: 17.4, ENG: 11.5, POR: 11.3, BRA: 9.3, ARG: 9.0, GER: 5.9, NED: 4.3,
  NOR: 2.9, JPN: 2.5, BEL: 2.3, MAR: 2.3, COL: 1.9, MEX: 1.8, USA: 1.6, TUR: 1.5,
  SUI: 1.4, URY: 1.2, CRO: 1.1, ECU: 0.9, SEN: 0.8, SWE: 0.7, AUT: 0.6, CIV: 0.5,
  CAN: 0.5, KOR: 0.4, PAR: 0.4, SCO: 0.4, CZE: 0.4, EGY: 0.4, ALG: 0.4, BIH: 0.4,
  TUN: 0.4, GHA: 0.3, COD: 0.3, AUS: 0.3, NZL: 0.3, JOR: 0.3, CUW: 0.3, UZB: 0.3,
  PAN: 0.3, IRQ: 0.3, RSA: 0.3, CPV: 0.3, QAT: 0.3, KSA: 0.3, IRN: 0.1, HAI: 0.1,
};

const FALLBACK_PROB = 2.0; // unknown team (e.g. a placeholder that somehow resolved without a code)
const BASELINE = 10; // favourites (~the strongest) land near ×1
const MAX_MULT = 10;

/** How much of an underdog a team is: 1× (favourite) … up to 10× (long shot). */
export function darkHorseMultiplier(code: string | null | undefined): number {
  const p = (code ? WIN_PROBABILITY[code.toUpperCase()] : undefined) ?? FALLBACK_PROB;
  return Math.min(MAX_MULT, Math.max(1, Math.round(BASELINE / p)));
}

/** Round weight — deeper runs are worth more. */
export const ADVANCE_WEIGHT: Record<Stage, number> = {
  GROUP_STAGE: 0,
  LAST_32: 1,
  LAST_16: 2,
  QUARTER_FINALS: 3,
  THIRD_PLACE: 1,
  SEMI_FINALS: 4,
  FINAL: 5,
};

/** Points for correctly predicting `code` advances in `stage`: round weight × dark-horse multiplier. */
export function darkHorsePoints(stage: Stage, code: string | null | undefined): number {
  return ADVANCE_WEIGHT[stage] * darkHorseMultiplier(code);
}

// --- Dark Horse award ---
// Score = title probability × weight of the DEEPEST round a team reached. Weights DESCEND, so going
// further multiplies by a smaller number → the LOWEST score is the biggest underdog that went furthest.
export const STAGE_WEIGHT: Record<Stage, number> = {
  GROUP_STAGE: 32, // never reached the knockouts → heaviest (worst)
  LAST_32: 16,
  LAST_16: 8,
  QUARTER_FINALS: 4,
  SEMI_FINALS: 2,
  THIRD_PLACE: 2, // reached the semis (lost it)
  FINAL: 1, // reached the final → lightest (best)
};

export function teamWinProbability(code: string | null | undefined): number {
  return (code ? WIN_PROBABILITY[code.toUpperCase()] : undefined) ?? FALLBACK_PROB;
}

/** Dark-horse score (lower = better): title probability × the lightest (deepest) stage weight reached. */
export function darkHorseScore(code: string | null | undefined, deepestWeight: number): number {
  return teamWinProbability(code) * deepestWeight;
}

/** Leaderboard bonus for the dark-horse ranking by placement (1st, 2nd, 3rd). */
export const DARK_HORSE_PLACEMENT = [20, 10, 5];
