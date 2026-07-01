import type { BracketSide, Stage } from '@wc2026/shared';

/** Knockout rounds in tournament order (only those with matches are shown). */
export const KO_ROUNDS: { stage: Stage; label: string; short: string }[] = [
  { stage: 'LAST_32', label: 'Round of 32', short: 'R32' },
  { stage: 'LAST_16', label: 'Round of 16', short: 'R16' },
  { stage: 'QUARTER_FINALS', label: 'Quarter-finals', short: 'QF' },
  { stage: 'SEMI_FINALS', label: 'Semi-finals', short: 'SF' },
  { stage: 'THIRD_PLACE', label: 'Third place', short: '3rd' },
  { stage: 'FINAL', label: 'Final', short: 'Final' },
];

/**
 * The side the player predicted to advance from a knockout tie:
 * the winner of their predicted scoreline, or their penWinner on a predicted draw.
 * Null when there's no prediction (or a draw with no pen winner chosen).
 */
export function predictedAdvancer(
  pred: { home: number; away: number; penWinner?: BracketSide | null } | undefined,
): BracketSide | null {
  if (!pred) return null;
  if (pred.home > pred.away) return 'HOME';
  if (pred.away > pred.home) return 'AWAY';
  return pred.penWinner ?? null;
}
