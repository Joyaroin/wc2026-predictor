// Tournament Winner award: pick the champion before kick-off; +10 if they win the cup.
import { teamWinProbability, awardsLocked, type Match } from '@wc2026/shared';
import type { Clock } from '../lib/clock';
import type { TournamentWinnerRepo, TournamentWinnerPick } from '../repos/types';
import type { MatchService } from './matches';
import { LockedError, ValidationError } from '../lib/errors';

export const TOURNAMENT_WINNER_BONUS = 10;

export interface TournamentWinnerStatus {
  teams: { code: string; name: string; prob: number }[];
  pick: { teamCode: string; teamName: string; points: number } | null;
  champion: { code: string; name: string } | null;
  locked: boolean;
}

export interface TournamentWinnerService {
  getStatus(callerId: string): Promise<TournamentWinnerStatus>;
  setPick(callerId: string, teamCode: string, teamName: string): Promise<TournamentWinnerPick>;
  refresh(): Promise<void>;
}

/** The cup winner, once the final is decided. */
function champion(matches: Match[]): { code: string; name: string } | null {
  const final = matches.find((m) => m.stage === 'FINAL' && (m.winner === 'HOME' || m.winner === 'AWAY'));
  if (!final) return null;
  const code = final.winner === 'HOME' ? final.homeCode : final.awayCode;
  const name = final.winner === 'HOME' ? final.homeTeam : final.awayTeam;
  return code ? { code: code.toUpperCase(), name } : null;
}

export function createTournamentWinnerService(
  repo: TournamentWinnerRepo,
  matchService: MatchService,
  clock: Clock,
): TournamentWinnerService {
  async function teamPool(): Promise<{ code: string; name: string; prob: number }[]> {
    const seen = new Map<string, string>();
    for (const m of await matchService.list()) {
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
      const [teams, pick, matches, locked] = await Promise.all([
        teamPool(),
        repo.get(callerId),
        matchService.list(),
        isLocked(),
      ]);
      return {
        teams,
        pick: pick ? { teamCode: pick.teamCode, teamName: pick.teamName, points: pick.points } : null,
        champion: champion(matches),
        locked,
      };
    },

    async setPick(callerId, teamCode, teamName) {
      const pool = await teamPool();
      const team = pool.find((t) => t.code === teamCode.toUpperCase());
      if (!team) throw new ValidationError('Pick a team from the tournament');
      if (await isLocked()) throw new LockedError();

      const now = clock.now().toISOString();
      const existing = await repo.get(callerId);
      const pick: TournamentWinnerPick = {
        playerId: callerId,
        teamCode: team.code,
        teamName: team.name,
        points: existing?.points ?? 0,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      await repo.put(pick);
      return pick;
    },

    async refresh() {
      const matches = await matchService.list();
      const champ = champion(matches);
      if (!champ) return;
      const now = clock.now().toISOString();
      for (const pick of await repo.scanAll()) {
        const pts = pick.teamCode === champ.code ? TOURNAMENT_WINNER_BONUS : 0;
        if (pts !== pick.points) await repo.put({ ...pick, points: pts, updatedAt: now });
      }
    },
  };
}
