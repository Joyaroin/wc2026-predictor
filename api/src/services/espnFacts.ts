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

/** A single UTC date (from an ISO instant) as YYYYMMDD. */
function utcDay(d: Date): string {
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
}

/** Last `days` UTC dates (inclusive) as YYYYMMDD. */
function recentDates(now: Date, days: number): string[] {
  const out: string[] = [];
  for (let i = days; i >= 0; i--) {
    out.push(utcDay(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i))));
  }
  return out;
}

// Cap on extra back-fill dates fetched per run, so a long outage can't fan out an unbounded
// number of ESPN scoreboard calls in a single ingest.
const MAX_BACKFILL_DATES = 40;

/** A finished match that has a score but no recorded first-goal team — its facts were missed. */
function needsFirstGoal(m: Match): boolean {
  return m.status === 'FINISHED' && m.homeScore !== null && m.awayScore !== null && (m.firstGoalTeam ?? null) === null;
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

      // Always sweep the last 3 days (cheap), AND back-fill any FINISHED-with-score match that still
      // lacks a firstGoalTeam — a longer cron outage would otherwise permanently lose those facts
      // (their dates fall outside the recent window). Dedupe and cap the total dates fetched.
      const recent = recentDates(now, 2);
      const dates = new Set(recent);
      const cap = recent.length + MAX_BACKFILL_DATES;
      const backfill = all.filter(needsFirstGoal).map((m) => utcDay(new Date(Date.parse(m.kickoff)))).sort();
      for (const day of new Set(backfill)) {
        if (dates.size >= cap) break;
        dates.add(day);
      }

      let facts: MatchFirstGoal[];
      try {
        facts = await espn.fetchMatchFirstGoals([...dates]);
      } catch (err) {
        logger.warn('espn facts fetch failed', { error: err instanceof Error ? err.message : 'unknown' });
        return;
      }

      for (const f of facts) {
        const day = f.date.slice(0, 10);
        const match = all.find((m) => m.kickoff.slice(0, 10) === day && teamsMatch(m, f));
        if (!match) continue;

        let firstGoalTeam: 'HOME' | 'AWAY' | 'NONE' = 'NONE';
        let firstScorerId: string | null = null;
        let firstScorerName: string | null = null;
        if (f.first) {
          const scoringTeam = f.first.side === 'HOME' ? f.homeName : f.awayName;
          firstGoalTeam = canon(scoringTeam) === canon(match.homeTeam) ? 'HOME' : canon(scoringTeam) === canon(match.awayTeam) ? 'AWAY' : 'NONE';
          firstScorerId = f.first.scorerId;
          firstScorerName = f.first.scorerName;
        }

        if (match.firstGoalTeam === firstGoalTeam && (match.firstScorerId ?? null) === firstScorerId) continue;
        await matches.upsert({ ...match, firstGoalTeam, firstScorerId, firstScorerName });
        await scoring.scoreMatch(match.id);
        logger.info('espn first-goal ingested', { matchId: match.id, firstGoalTeam, firstScorerName });
      }
    },
  };
}
