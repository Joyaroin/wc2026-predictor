// Dark Horse award: pick a team; score = title probability × weight of deepest round reached.
// LOWER score is better (big underdog that went far). Placement pays 20/10/5 to the top 3.
import {
  STAGE_WEIGHT,
  DARK_HORSE_PLACEMENT,
  darkHorseScore,
  teamWinProbability,
  type Match,
  awardsLocked,
  tournamentFinished,
} from '@wc2026/shared';
import type { Clock } from '../lib/clock';
import type { DarkHorseRepo, DarkHorsePick } from '../repos/types';
import type { MatchService } from './matches';
import { LockedError, ValidationError } from '../lib/errors';

export interface DarkHorseTeam {
  code: string;
  name: string;
  prob: number;
}
export interface DarkHorseStatus {
  teams: DarkHorseTeam[];
  pick: { teamCode: string; teamName: string; score: number; stage: string; placement: number; points: number } | null;
  totalPicks: number;
  locked: boolean;
}

export interface DarkHorseService {
  getStatus(callerId: string): Promise<DarkHorseStatus>;
  setPick(callerId: string, teamCode: string, teamName: string): Promise<DarkHorsePick>;
  refresh(): Promise<void>;
}

const WEIGHT_STAGE: Record<number, string> = {
  1: 'Final',
  1.5: 'Third place (won)',
  2: 'Semi-final',
  6: 'Quarter-final',
  14: 'Round of 16',
  30: 'Round of 32',
  5000: 'Group stage',
};

/** The deepest (lightest-weight) stage each team has reached, by FIFA code. */
function deepestWeightByCode(matches: Match[]): Map<string, number> {
  const out = new Map<string, number>();
  const apply = (code: string | null | undefined, w: number) => {
    if (!code) return;
    const key = code.toUpperCase();
    const cur = out.get(key);
    if (cur === undefined || w < cur) out.set(key, w);
  };
  for (const m of matches) {
    const w = STAGE_WEIGHT[m.stage];
    if (m.stage === 'THIRD_PLACE') {
      // Only the WINNER of the third-place match earns the lighter weight; the loser (4th) keeps the semi weight.
      if (m.winner === 'HOME') apply(m.homeCode, w);
      else if (m.winner === 'AWAY') apply(m.awayCode, w);
      continue;
    }
    apply(m.homeCode, w);
    apply(m.awayCode, w);
  }
  return out;
}

interface Standing {
  score: number;
  points: number;
  placement: number;
}

/** Rank picks by score ascending; pay placement bonus by distinct-score groups (ties share a placement). */
function computeStandings(weights: Map<string, number>, picks: DarkHorsePick[]): Map<string, Standing> {
  const scored = picks
    .map((p) => ({ p, score: darkHorseScore(p.teamCode, weights.get(p.teamCode.toUpperCase()) ?? STAGE_WEIGHT.GROUP_STAGE) }))
    .sort((a, b) => a.score - b.score);

  const result = new Map<string, Standing>();
  let groupIdx = -1;
  let lastScore = Number.NaN;
  for (let i = 0; i < scored.length; i++) {
    const s = scored[i]!;
    if (s.score !== lastScore) {
      groupIdx++;
      lastScore = s.score;
    }
    const placement = groupIdx + 1;
    const points = groupIdx < DARK_HORSE_PLACEMENT.length ? DARK_HORSE_PLACEMENT[groupIdx]! : 0;
    result.set(s.p.playerId, { score: s.score, points, placement });
  }
  return result;
}

export function createDarkHorseService(
  darkHorse: DarkHorseRepo,
  matchService: MatchService,
  clock: Clock,
): DarkHorseService {
  // Build the pool from an already-fetched match list to avoid a second matchService.list() per poll.
  function teamPool(matches: Match[]): DarkHorseTeam[] {
    const seen = new Map<string, string>(); // code -> name
    for (const m of matches) {
      if (m.stage !== 'GROUP_STAGE') continue;
      if (m.homeCode) seen.set(m.homeCode.toUpperCase(), m.homeTeam);
      if (m.awayCode) seen.set(m.awayCode.toUpperCase(), m.awayTeam);
    }
    return [...seen.entries()]
      .map(([code, name]) => ({ code, name, prob: teamWinProbability(code) }))
      .sort((a, b) => b.prob - a.prob || a.name.localeCompare(b.name));
  }

  async function isLocked(): Promise<boolean> {
    return awardsLocked(clock.now());
  }

  return {
    async getStatus(callerId) {
      // Fetch matches + picks ONCE; derive teamPool, weights and standings from them (no duplicate
      // matchService.list() / deepestWeightByCode calls per poll). The full scanAll below is still
      // O(picks) per poll — persisting score/placement at refresh time would remove it, but that is a
      // larger change; the minimal safe fix here is removing the redundant computation.
      const [pick, matches, picks, locked] = await Promise.all([
        darkHorse.get(callerId),
        matchService.list(),
        darkHorse.scanAll(),
        isLocked(),
      ]);
      const teams = teamPool(matches);
      const weights = deepestWeightByCode(matches);
      let pickView: DarkHorseStatus['pick'] = null;
      if (pick) {
        const standings = computeStandings(weights, picks);
        const me = standings.get(callerId);
        const weight = weights.get(pick.teamCode.toUpperCase()) ?? STAGE_WEIGHT.GROUP_STAGE;
        pickView = {
          teamCode: pick.teamCode,
          teamName: pick.teamName,
          score: me?.score ?? darkHorseScore(pick.teamCode, weight),
          stage: WEIGHT_STAGE[weight] ?? 'Group stage',
          placement: me?.placement ?? 0,
          points: pick.points, // stored value — only set once the tournament ends
        };
      }
      return { teams, pick: pickView, totalPicks: picks.length, locked };
    },

    async setPick(callerId, teamCode, teamName) {
      const pool = teamPool(await matchService.list());
      const team = pool.find((t) => t.code === teamCode.toUpperCase());
      if (!team) throw new ValidationError('Pick a team from the tournament');
      if (await isLocked()) throw new LockedError();

      const now = clock.now().toISOString();
      const existing = await darkHorse.get(callerId);
      const pick: DarkHorsePick = {
        playerId: callerId,
        teamCode: team.code,
        teamName: team.name,
        points: existing?.points ?? 0,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      await darkHorse.put(pick);
      return pick;
    },

    async refresh() {
      const [matches, picks] = await Promise.all([matchService.list(), darkHorse.scanAll()]);
      if (picks.length === 0) return;
      // Placements are a live preview; placement points only pay out once the tournament is over.
      const finished = tournamentFinished(matches);
      const standings = computeStandings(deepestWeightByCode(matches), picks);
      const now = clock.now().toISOString();
      for (const pick of picks) {
        const pts = finished ? (standings.get(pick.playerId)?.points ?? 0) : 0;
        if (pts !== pick.points) await darkHorse.put({ ...pick, points: pts, updatedAt: now });
      }
    },
  };
}
