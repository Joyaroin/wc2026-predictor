// ESPN (unofficial, no key) integration for 2026 World Cup player data: squads + goalscorers.
// Endpoints under site.api.espn.com/apis/site/v2/sports/soccer/fifa.world.
import type { Logger } from '../lib/logger';

const BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world';

export interface WcPlayer {
  id: string;
  name: string;
  team: string;
  position: string; // e.g. F / M / D / G
}
export interface ScorerTally {
  scorerId: string;
  scorerName: string;
  goals: number;
}
export interface EventGoals {
  eventId: string;
  date: string; // ISO
  goals: { scorerId: string; scorerName: string }[];
}

interface Json {
  // loosely typed ESPN payloads
  [k: string]: unknown;
}

const get = <T>(o: unknown, ...path: (string | number)[]): T | undefined => {
  let cur: unknown = o;
  for (const k of path) {
    if (cur == null) return undefined;
    cur = (cur as Record<string | number, unknown>)[k];
  }
  return cur as T | undefined;
};

export interface CompetitionGoal {
  scorerId: string;
  scorerName: string;
  side: 'HOME' | 'AWAY';
  shootout: boolean;
  ownGoal: boolean;
}

/**
 * Goal scorers from a scoreboard event's `competition` — the reliable source that includes
 * `athletesInvolved` (the `/summary` keyEvents do not). Each goal has its side + shootout/own-goal flags.
 */
export function goalsFromCompetition(comp: Json): { homeName: string; awayName: string; goals: CompetitionGoal[] } {
  const sideById = new Map<string, 'HOME' | 'AWAY'>();
  let homeName = '';
  let awayName = '';
  for (const c of get<Json[]>(comp, 'competitors') ?? []) {
    const side = get<string>(c, 'homeAway') === 'home' ? 'HOME' : 'AWAY';
    const id = String(get<string | number>(c, 'team', 'id') ?? get<string | number>(c, 'id') ?? '');
    const name = get<string>(c, 'team', 'displayName') ?? '';
    if (id) sideById.set(id, side);
    if (side === 'HOME') homeName = name;
    else awayName = name;
  }
  const goals: CompetitionGoal[] = [];
  for (const d of get<Json[]>(comp, 'details') ?? []) {
    if (get<boolean>(d, 'scoringPlay') !== true) continue;
    const side = sideById.get(String(get<string | number>(d, 'team', 'id') ?? ''));
    const ath = (get<Json[]>(d, 'athletesInvolved') ?? [])[0];
    const scorerId = ath ? String(get<string | number>(ath, 'id') ?? '') : '';
    const scorerName = (ath && get<string>(ath, 'displayName')) ?? 'Unknown';
    if (!side || !scorerId) continue;
    goals.push({ scorerId, scorerName, side, shootout: get<boolean>(d, 'shootout') === true, ownGoal: get<boolean>(d, 'ownGoal') === true });
  }
  return { homeName, awayName, goals };
}

export interface MatchFirstGoal {
  date: string; // ISO
  homeName: string;
  awayName: string;
  /** First goal: which ESPN side scored + the scorer. null = no goal yet (or finished 0-0). */
  first: { side: 'HOME' | 'AWAY'; scorerId: string; scorerName: string } | null;
  /** Live game minute from ESPN's clock (e.g. 67). Null when not available/finished. */
  minute: number | null;
  /** True once the match is final ('post'); a null `first` then means a real 0-0. */
  finished: boolean;
}

export interface EspnClient {
  fetchPlayerPool(): Promise<WcPlayer[]>;
  fetchFinishedEventGoals(dates: string[], skipEventIds: Set<string>): Promise<EventGoals[]>;
  fetchMatchFirstGoals(dates: string[]): Promise<MatchFirstGoal[]>;
}

export function createEspnClient(logger: Logger, fetchImpl: typeof fetch = fetch): EspnClient {
  async function json(url: string): Promise<Json> {
    const res = await fetchImpl(url);
    if (!res.ok) throw new Error(`ESPN ${res.status} for ${url}`);
    return (await res.json()) as Json;
  }

  return {
    async fetchPlayerPool() {
      const teamsData = await json(`${BASE}/teams`);
      const teams = get<Json[]>(teamsData, 'sports', 0, 'leagues', 0, 'teams') ?? [];
      const players: WcPlayer[] = [];
      for (const t of teams) {
        const teamId = get<string | number>(t, 'team', 'id');
        const teamName = get<string>(t, 'team', 'displayName') ?? 'Unknown';
        if (teamId == null) continue;
        try {
          const roster = await json(`${BASE}/teams/${teamId}/roster`);
          for (const grp of get<Json[]>(roster, 'athletes') ?? []) {
            const items = (get<Json[]>(grp, 'items') ?? (get(grp, 'displayName') ? [grp] : [])) as Json[];
            for (const a of items) {
              const id = get<string | number>(a, 'id');
              const name = get<string>(a, 'displayName');
              const position = get<string>(a, 'position', 'abbreviation') ?? get<string>(a, 'position', 'name') ?? '';
              if (id != null && name) players.push({ id: String(id), name, team: teamName, position });
            }
          }
        } catch (err) {
          logger.warn('espn roster failed', { teamId, error: err instanceof Error ? err.message : 'unknown' });
        }
      }
      return players;
    },

    async fetchMatchFirstGoals(dates) {
      const result: MatchFirstGoal[] = [];
      for (const date of dates) {
        let board: Json;
        try {
          board = await json(`${BASE}/scoreboard?dates=${date}`);
        } catch (err) {
          logger.warn('espn scoreboard failed', { date, error: err instanceof Error ? err.message : 'unknown' });
          continue;
        }
        for (const e of get<Json[]>(board, 'events') ?? []) {
          const state = get<string>(e, 'status', 'type', 'state');
          if (state !== 'post' && state !== 'in') continue; // live or finished
          const comp = (get<Json[]>(e, 'competitions') ?? [])[0];
          if (!comp) continue;
          const { homeName, awayName, goals } = goalsFromCompetition(comp);
          const fg = goals.find((g) => !g.shootout); // first goal in normal/extra time (not a shootout pen)
          const first = fg ? { side: fg.side, scorerId: fg.scorerId, scorerName: fg.scorerName } : null;
          const dc = get<string>(e, 'status', 'displayClock'); // e.g. "67'" or "90'+3'"
          const parsed = dc != null ? parseInt(dc, 10) : NaN;
          const minute = state === 'in' && Number.isFinite(parsed) ? parsed : null;
          result.push({ date: get<string>(e, 'date') ?? date, homeName, awayName, first, minute, finished: state === 'post' });
        }
      }
      return result;
    },

    async fetchFinishedEventGoals(dates, skipEventIds) {
      const result: EventGoals[] = [];
      for (const date of dates) {
        let board: Json;
        try {
          board = await json(`${BASE}/scoreboard?dates=${date}`);
        } catch (err) {
          logger.warn('espn scoreboard failed', { date, error: err instanceof Error ? err.message : 'unknown' });
          continue;
        }
        for (const e of get<Json[]>(board, 'events') ?? []) {
          const id = String(get<string | number>(e, 'id') ?? '');
          const state = get<string>(e, 'status', 'type', 'state'); // 'post' = finished
          if (!id || state !== 'post' || skipEventIds.has(id)) continue;
          const comp = (get<Json[]>(e, 'competitions') ?? [])[0];
          if (!comp) continue;
          // Real goals only — exclude penalty-shootout goals and own goals (don't count for the Golden Boot).
          const goals = goalsFromCompetition(comp).goals
            .filter((g) => !g.shootout && !g.ownGoal)
            .map((g) => ({ scorerId: g.scorerId, scorerName: g.scorerName }));
          result.push({ eventId: id, date: get<string>(e, 'date') ?? date, goals });
        }
      }
      return result;
    },
  };
}

/** Aggregate stored per-event goals into a sorted top-scorer tally. */
export function tallyTopScorers(events: EventGoals[]): ScorerTally[] {
  const byId = new Map<string, ScorerTally>();
  for (const ev of events) {
    for (const g of ev.goals) {
      const t = byId.get(g.scorerId) ?? { scorerId: g.scorerId, scorerName: g.scorerName, goals: 0 };
      t.goals++;
      t.scorerName = g.scorerName;
      byId.set(g.scorerId, t);
    }
  }
  return [...byId.values()].sort((a, b) => b.goals - a.goals || a.scorerName.localeCompare(b.scorerName));
}
