// Golden Boot / "Player of the Tournament": predict the top scorer; auto-scored from ESPN goals.
import { awardsLocked, tournamentFinished } from '@wc2026/shared';
import type { Clock } from '../lib/clock';
import type { GoldenBootRepo, StatsRepo, GoldenBootPick, TopScorer } from '../repos/types';
import type { MatchService } from './matches';
import { tallyTopScorers, type EspnClient, type WcPlayer } from '../integration/espnClient';
import { LockedError, ValidationError } from '../lib/errors';
import type { Logger } from '../lib/logger';

export const GOLDEN_BOOT_BONUS = 15;
const POOL_TTL_MS = 6 * 60 * 60 * 1000;
// Negative-cache window: after an empty/failed ESPN fan-out, wait this long before refetching so
// repeated requests don't each re-issue ~49 sequential roster calls while the pool is unavailable.
const POOL_NEGATIVE_TTL_MS = 60 * 1000;
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
      // A populated pool is cached for POOL_TTL_MS; an empty/failed fetch is negative-cached for the
      // shorter POOL_NEGATIVE_TTL_MS. Either way poolAt is recorded so we don't re-fan-out every request.
      const ttl = pool.length > 0 ? POOL_TTL_MS : POOL_NEGATIVE_TTL_MS;
      if (poolAt > 0 && Date.now() - poolAt < ttl) return [...FUN_PLAYERS, ...pool];
      try {
        const fetched = await espn.fetchPlayerPool();
        if (fetched.length > 0) pool = fetched;
      } catch (err) {
        logger.warn('golden boot pool fetch failed', { error: err instanceof Error ? err.message : 'unknown' });
      }
      // Record the attempt time even on empty/error so the negative-cache cooldown applies.
      poolAt = Date.now();
      return [...FUN_PLAYERS, ...pool];
    },

    async setPick(callerId, scorerId, scorerName) {
      if (!scorerId.trim() || !scorerName.trim()) throw new ValidationError('Pick a player');
      if (awardsLocked(clock.now())) throw new LockedError();

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
      const [pick, leader] = await Promise.all([goldenBoot.get(callerId), stats.getLeader()]);
      const locked = awardsLocked(clock.now());
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
          // tally is sorted by goals desc — element 0 holds the max; on a TIE several scorers share it.
          const maxGoals = tally[0]!.goals;
          const winners = new Set(tally.filter((t) => t.goals === maxGoals).map((t) => t.scorerId));
          const leader = tally[0]!; // display leader (alphabetically-first among the tied top scorers)
          await stats.setLeader({ scorerId: leader.scorerId, scorerName: leader.scorerName, goals: leader.goals });
          // The live leader is display-only; points pay out once the tournament is over.
          // On a shared Golden Boot (a tie at the top), EVERY picker of a tied top scorer is paid.
          const finished = tournamentFinished(await matchService.list());
          for (const pick of await goldenBoot.scanAll()) {
            const pts = finished && winners.has(pick.scorerId) ? GOLDEN_BOOT_BONUS : 0;
            if (pts !== pick.points) await goldenBoot.put({ ...pick, points: pts, updatedAt: now.toISOString() });
          }
          logger.info('golden boot leader updated', { scorer: leader.scorerName, goals: leader.goals, tiedWinners: winners.size, finished });
        }
      } catch (err) {
        logger.warn('golden boot refresh failed', { error: err instanceof Error ? err.message : 'unknown' });
      }
      await stats.setLastEspnRun(now.toISOString());
    },
  };
}
