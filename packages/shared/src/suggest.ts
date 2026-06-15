// Statistical scoreline suggestion derived purely from bookmaker odds (no hardcoded ratings,
// no app data). Implied win/draw/away probabilities + the over/under total are turned into each
// side's expected goals via a Poisson fit, then the most likely scorelines are read off.
import type { BracketSide } from './types';

/** Raw odds for one match (from a bookmaker, e.g. ESPN's pickcenter). American moneylines. */
export interface MatchOdds {
  overUnder: number | null; // total goals line
  homeMoneyLine: number | null;
  drawMoneyLine: number | null;
  awayMoneyLine: number | null;
  source?: string | null; // provider name, e.g. "DraftKings"
}

export interface SuggestedScore {
  home: number;
  away: number;
  prob: number; // model probability of this exact scoreline (0..1)
}

export interface ScoreSuggestion {
  scores: SuggestedScore[]; // most-likely scorelines, descending (up to 3)
  firstTeam: BracketSide; // side more likely to score first (higher expected goals)
  confidence: number; // probability of the top scoreline
  source: string | null;
}

/** American moneyline → implied probability (includes the book's margin). */
function mlProb(ml: number): number {
  return ml < 0 ? -ml / (-ml + 100) : 100 / (ml + 100);
}

function poisson(k: number, lambda: number): number {
  let fact = 1;
  for (let i = 2; i <= k; i++) fact *= i;
  return (Math.exp(-lambda) * Math.pow(lambda, k)) / fact;
}

/** P(home win) − P(away win) for a Poisson model with the given expected goals. */
function outcomeTilt(lamH: number, lamA: number, max = 10): number {
  let hw = 0;
  let aw = 0;
  for (let i = 0; i <= max; i++) {
    for (let j = 0; j <= max; j++) {
      const p = poisson(i, lamH) * poisson(j, lamA);
      if (i > j) hw += p;
      else if (i < j) aw += p;
    }
  }
  return hw - aw;
}

/**
 * Build a scoreline suggestion from odds. Returns null when the odds are too sparse
 * (need the total and both team moneylines).
 */
export function suggestFromOdds(o: MatchOdds): ScoreSuggestion | null {
  const total = o.overUnder;
  if (total == null || total <= 0 || o.homeMoneyLine == null || o.awayMoneyLine == null) return null;

  // Normalise the implied probabilities (strip the margin) and take the home/away tilt.
  const pH = mlProb(o.homeMoneyLine);
  const pA = mlProb(o.awayMoneyLine);
  const pD = o.drawMoneyLine != null ? mlProb(o.drawMoneyLine) : 0;
  const sum = pH + pA + pD;
  if (sum <= 0) return null;
  const target = (pH - pA) / sum;

  // Fit goal supremacy s (home − away) keeping the total fixed, so the model's tilt matches the book.
  let lo = -total + 0.05;
  let hi = total - 0.05;
  for (let it = 0; it < 40; it++) {
    const s = (lo + hi) / 2;
    if (outcomeTilt((total + s) / 2, (total - s) / 2) < target) lo = s;
    else hi = s;
  }
  const s = (lo + hi) / 2;
  const lamH = Math.max(0.05, (total + s) / 2);
  const lamA = Math.max(0.05, (total - s) / 2);

  const cells: SuggestedScore[] = [];
  for (let i = 0; i <= 7; i++) {
    for (let j = 0; j <= 7; j++) {
      cells.push({ home: i, away: j, prob: poisson(i, lamH) * poisson(j, lamA) });
    }
  }
  cells.sort((a, b) => b.prob - a.prob);
  const scores = cells.slice(0, 3).map((c) => ({ home: c.home, away: c.away, prob: Math.round(c.prob * 1000) / 1000 }));

  return {
    scores,
    firstTeam: lamH >= lamA ? 'HOME' : 'AWAY',
    confidence: scores[0]?.prob ?? 0,
    source: o.source ?? null,
  };
}
