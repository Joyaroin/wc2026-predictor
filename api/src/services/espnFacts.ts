// Ingests per-match "first goal" facts from ESPN, maps them to our (football-data) matches by
// date + team names, stores them, and re-scores so first-team (+2) / first-player (+6) land.
import type { Match } from '@wc2026/shared';
import type { EspnClient, MatchFirstGoal } from '../integration/espnClient';
import type { MatchRepo } from '../repos/types';
import type { ScoringService } from './scoring';
import type { Clock } from '../lib/clock';
import type { Logger } from '../lib/logger';

export interface EspnFactsService {
  ingest(): Promise<void>;
}

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]/g, '');
}
// Cross-provider name reconciliation (ESPN ↔ football-data) → canonical form.
const ALIAS: Record<string, string> = {
  southkorea: 'korea', korearepublic: 'korea',
  unitedstates: 'usa', us: 'usa',
  ivorycoast: 'cotedivoire', cotedivoire: 'cotedivoire',
  drcongo: 'congodr', congodr: 'congodr', democraticrepublicofthecongo: 'congodr',
  czechrepublic: 'czechia', czechia: 'czechia',
  capeverdeislands: 'capeverde', caboverde: 'capeverde',
  turkiye: 'turkey', turkey: 'turkey',
  bosniaherzegovina: 'bosnia', bosniaandherzegovina: 'bosnia',
};
function canon(s: string): string {
  const n = normalize(s);
  return ALIAS[n] ?? n;
}

/** Last `days` UTC dates (inclusive) as YYYYMMDD. */
function recentDates(now: Date, days: number): string[] {
  const out: string[] = [];
  for (let i = days; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i));
    out.push(`${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`);
  }
  return out;
}

function teamsMatch(m: Match, f: MatchFirstGoal): boolean {
  const ours = new Set([canon(m.homeTeam), canon(m.awayTeam)]);
  return ours.has(canon(f.homeName)) && ours.has(canon(f.awayName));
}

export function createEspnFactsService(
  espn: EspnClient,
  matches: MatchRepo,
  scoring: ScoringService,
  clock: Clock,
  logger: Logger,
): EspnFactsService {
  return {
    async ingest() {
      const all = await matches.listAll();
      if (all.length === 0) return;
      const now = clock.now();
      const start = Math.min(...all.map((m) => Date.parse(m.kickoff)));
      if (now.getTime() < start) return; // tournament hasn't started

      let facts: MatchFirstGoal[];
      try {
        facts = await espn.fetchMatchFirstGoals(recentDates(now, 2)); // live + recently-finished matches
      } catch (err) {
        logger.warn('espn facts fetch failed', { error: err instanceof Error ? err.message : 'unknown' });
        return;
      }

      for (const f of facts) {
        const day = f.date.slice(0, 10);
        const match = all.find((m) => m.kickoff.slice(0, 10) === day && teamsMatch(m, f));
        if (!match) continue;

        // First goal: settle it the moment a goal exists (works mid-match); only lock in 'NONE'
        // once the match is final — a live 0-0 must stay "unknown" so we don't show a wrong ✗.
        let firstGoalTeam: 'HOME' | 'AWAY' | 'NONE' | null = match.firstGoalTeam ?? null;
        let firstScorerId: string | null = match.firstScorerId ?? null;
        let firstScorerName: string | null = match.firstScorerName ?? null;
        if (f.first) {
          const scoringTeam = f.first.side === 'HOME' ? f.homeName : f.awayName;
          firstGoalTeam = canon(scoringTeam) === canon(match.homeTeam) ? 'HOME' : canon(scoringTeam) === canon(match.awayTeam) ? 'AWAY' : 'NONE';
          firstScorerId = f.first.scorerId;
          firstScorerName = f.first.scorerName;
        } else if (f.finished) {
          firstGoalTeam = 'NONE';
          firstScorerId = null;
          firstScorerName = null;
        }

        // Live game minute straight from ESPN's clock (football-data doesn't provide one).
        const minute = f.finished ? null : f.minute;

        const goalChanged = match.firstGoalTeam !== firstGoalTeam || (match.firstScorerId ?? null) !== firstScorerId;
        const minuteChanged = (match.minute ?? null) !== minute;
        if (!goalChanged && !minuteChanged) continue;

        await matches.upsert({ ...match, firstGoalTeam, firstScorerId, firstScorerName, minute });
        if (goalChanged) await scoring.scoreMatch(match.id);
        logger.info('espn facts ingested', { matchId: match.id, firstGoalTeam, firstScorerName, minute });
      }
    },
  };
}
