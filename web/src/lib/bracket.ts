import type { BracketSide, Stage } from '@wc2026/shared';

export interface BracketMatchLike {
  id: string;
  stage: Stage;
  homeTeam: string;
  homeCode: string | null;
  awayTeam: string;
  awayCode: string | null;
  kickoff: string;
}

export interface BracketColumn<T> {
  stage: Stage;
  matches: T[];
}

export interface SplitKnockoutBracket<T> {
  left: BracketColumn<T>[];
  right: BracketColumn<T>[];
  center: {
    final: T[];
    third: T[];
  };
  total: number;
}

// Rounds that feed the final from each side (outer -> inner).
export const SIDE_ROUNDS: Stage[] = ['LAST_32', 'LAST_16', 'QUARTER_FINALS', 'SEMI_FINALS'];

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

function matchOrder<T extends BracketMatchLike>(a: T, b: T): number {
  const an = Number(a.id);
  const bn = Number(b.id);
  if (Number.isFinite(an) && Number.isFinite(bn) && an !== bn) return an - bn;
  const kickoff = a.kickoff.localeCompare(b.kickoff);
  if (kickoff !== 0) return kickoff;
  return a.id.localeCompare(b.id, undefined, { numeric: true });
}

function teamKey(code: string | null, name: string): string | null {
  if (code) return `code:${code.trim().toUpperCase()}`;
  const n = name.trim().toLowerCase();
  return n && n !== 'tbd' ? `name:${n}` : null;
}

function tracedSide<T extends BracketMatchLike>(match: T, teamSide: Map<string, 'L' | 'R'>): 'L' | 'R' | null {
  const sides = [
    teamKey(match.homeCode, match.homeTeam),
    teamKey(match.awayCode, match.awayTeam),
  ].flatMap((key) => {
    const side = key ? teamSide.get(key) : undefined;
    return side ? [side] : [];
  });
  const unique = new Set(sides);
  return unique.size === 1 ? sides[0]! : null;
}

function assignRoundSides<T extends BracketMatchLike>(
  matches: T[],
  stage: Stage,
  teamSide: Map<string, 'L' | 'R'>,
): Map<string, 'L' | 'R'> {
  const byId = new Map<string, 'L' | 'R'>();
  const half = Math.ceil(matches.length / 2);
  let leftCount = 0;
  let rightCount = 0;

  matches.forEach((match, index) => {
    const traced = stage === 'LAST_32' ? (index < half ? 'L' : 'R') : tracedSide(match, teamSide);
    if (!traced) return;
    if (traced === 'L' && leftCount < half) {
      byId.set(match.id, 'L');
      leftCount += 1;
    } else if (traced === 'R' && rightCount < matches.length - half) {
      byId.set(match.id, 'R');
      rightCount += 1;
    }
  });

  for (const match of matches) {
    if (byId.has(match.id)) continue;
    if (leftCount < half) {
      byId.set(match.id, 'L');
      leftCount += 1;
    } else {
      byId.set(match.id, 'R');
      rightCount += 1;
    }
  }

  return byId;
}

export function splitKnockoutBracket<T extends BracketMatchLike>(matches: readonly T[]): SplitKnockoutBracket<T> {
  const ko = matches.filter((m) => m.stage !== 'GROUP_STAGE').slice().sort(matchOrder);
  const byStage = (stage: Stage) => ko.filter((m) => m.stage === stage);

  const teamSide = new Map<string, 'L' | 'R'>();
  const sideById = new Map<string, 'L' | 'R'>();

  for (const stage of SIDE_ROUNDS) {
    const round = byStage(stage);
    const roundSides = assignRoundSides(round, stage, teamSide);
    for (const match of round) {
      const side = roundSides.get(match.id);
      if (!side) continue;
      sideById.set(match.id, side);
      if (stage === 'LAST_32') {
        const homeKey = teamKey(match.homeCode, match.homeTeam);
        const awayKey = teamKey(match.awayCode, match.awayTeam);
        if (homeKey) teamSide.set(homeKey, side);
        if (awayKey) teamSide.set(awayKey, side);
      }
    }
  }

  const colFor = (stage: Stage, side: 'L' | 'R') => byStage(stage).filter((m) => sideById.get(m.id) === side);
  return {
    left: SIDE_ROUNDS.map((stage) => ({ stage, matches: colFor(stage, 'L') })).filter((c) => c.matches.length),
    right: [...SIDE_ROUNDS].reverse().map((stage) => ({ stage, matches: colFor(stage, 'R') })).filter((c) => c.matches.length),
    center: { final: byStage('FINAL'), third: byStage('THIRD_PLACE') },
    total: ko.length,
  };
}
