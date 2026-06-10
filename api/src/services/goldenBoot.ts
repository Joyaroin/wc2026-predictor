// Golden Boot / "Player of the Tournament": predict the top scorer; auto-scored from ESPN goals.
import type { Clock } from '../lib/clock';
import type { GoldenBootRepo, StatsRepo, GoldenBootPick, TopScorer } from '../repos/types';
import type { MatchService } from './matches';
import { tallyTopScorers, type EspnClient, type WcPlayer } from '../integration/espnClient';
import { LockedError, ValidationError } from '../lib/errors';
import type { Logger } from '../lib/logger';

export const GOLDEN_BOOT_BONUS = 15;
const POOL_TTL_MS = 6 * 60 * 60 * 1000;
const ESPN_THROTTLE_MS = 15 * 60 * 1000;

// Custom joke entries added to the player pool (just for fun).
const FUN_PLAYERS: WcPlayer[] = [
  { id: 'fun-ryan-masri', name: 'Ryan Masri', team: 'Lebanon', position: '' },
  { id: 'fun-tarek-eid', name: 'Tarek Eid', team: 'Israel / Lebanon', position: '' },
  { id: 'fun-dany-alamedinne', name: 'Dany Alamedinne', team: 'Israel', position: '' },
  { id: 'fun-ziad', name: 'Ziad', team: 'Israel', position: '' },
  { id: 'fun-adham-sedik', name: 'Adham Sedik', team: 'Tanzania', position: '' },
];

export interface GoldenBootStatus {
  pick: { scorerId: string; scorerName: string; points: number } | null;
  leader: TopScorer | null;
  locked: boolean;
}

export interface GoldenBootService {
  getPlayerPool(): Promise<WcPlayer[]>;
  setPick(callerId: string, scorerId: string, scorerName: string): Promise<GoldenBootPick>;
  getStatus(callerId: string): Promise<GoldenBootStatus>;
  refresh(): Promise<void>;
}

/** UTC YYYYMMDD strings from start..end (inclusive), capped to 60 days. */
function datesBetween(start: Date, end: Date): string[] {
  const out: string[] = [];
  const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
  let guard = 0;
  while (d.getTime() <= last.getTime() && guard++ < 60) {
    out.push(`${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`);
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

export function createGoldenBootService(
  goldenBoot: GoldenBootRepo,
  stats: StatsRepo,
  matchService: MatchService,
  espn: EspnClient,
  clock: Clock,
  logger: Logger,
): GoldenBootService {
  let pool: WcPlayer[] = [];
  let poolAt = 0;

  async function tournamentStart(): Promise<Date | null> {
    const matches = await matchService.list();
    if (matches.length === 0) return null;
    return new Date(Math.min(...matches.map((m) => Date.parse(m.kickoff))));
  }

  return {
    async getPlayerPool() {
      if (pool.length > 0 && Date.now() - poolAt < POOL_TTL_MS) return [...FUN_PLAYERS, ...pool];
      try {
        const fetched = await espn.fetchPlayerPool();
        if (fetched.length > 0) {
          pool = fetched;
          poolAt = Date.now();
        }
      } catch (err) {
        logger.warn('golden boot pool fetch failed', { error: err instanceof Error ? err.message : 'unknown' });
      }
      return [...FUN_PLAYERS, ...pool];
    },

    async setPick(callerId, scorerId, scorerName) {
      if (!scorerId.trim() || !scorerName.trim()) throw new ValidationError('Pick a player');
      const start = await tournamentStart();
      if (start && clock.now().getTime() >= start.getTime()) throw new LockedError();

      const now = clock.now().toISOString();
      const existing = await goldenBoot.get(callerId);
      const pick: GoldenBootPick = {
        playerId: callerId,
        scorerId: scorerId.trim(),
        scorerName: scorerName.trim(),
        points: existing?.points ?? 0,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      await goldenBoot.put(pick);
      return pick;
    },

    async getStatus(callerId) {
      const [pick, leader, start] = await Promise.all([
        goldenBoot.get(callerId),
        stats.getLeader(),
        tournamentStart(),
      ]);
      const locked = start != null && clock.now().getTime() >= start.getTime();
      return {
        pick: pick ? { scorerId: pick.scorerId, scorerName: pick.scorerName, points: pick.points } : null,
        leader,
        locked,
      };
    },

    async refresh() {
      const now = clock.now();
      const last = await stats.getLastEspnRun();
      if (last && now.getTime() - Date.parse(last) < ESPN_THROTTLE_MS) return;

      const start = await tournamentStart();
      if (!start || now.getTime() < start.getTime()) {
        await stats.setLastEspnRun(now.toISOString());
        return; // tournament hasn't started — nothing to tally yet
      }

      try {
        const events = await espn.fetchFinishedEventGoals(datesBetween(start, now), new Set());
        const tally = tallyTopScorers(events);
        if (tally.length > 0) {
          const leader = tally[0]!;
          await stats.setLeader({ scorerId: leader.scorerId, scorerName: leader.scorerName, goals: leader.goals });
          for (const pick of await goldenBoot.scanAll()) {
            const pts = pick.scorerId === leader.scorerId ? GOLDEN_BOOT_BONUS : 0;
            if (pts !== pick.points) await goldenBoot.put({ ...pick, points: pts, updatedAt: now.toISOString() });
          }
          logger.info('golden boot leader updated', { scorer: leader.scorerName, goals: leader.goals });
        }
      } catch (err) {
        logger.warn('golden boot refresh failed', { error: err instanceof Error ? err.message : 'unknown' });
      }
      await stats.setLastEspnRun(now.toISOString());
    },
  };
}
