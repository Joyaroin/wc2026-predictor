// ESPN (unofficial, no key) integration for 2026 World Cup player data: squads + goalscorers.
// Endpoints under site.api.espn.com/apis/site/v2/sports/soccer/fifa.world.
import type { Logger } from '../lib/logger';

const BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world';

export interface WcPlayer {
  id: string;
  name: string;
  team: string;
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

/** Extract goal scorers from an ESPN match summary (keyEvents / scoringPlays, best-effort). */
export function extractGoals(summary: Json): { scorerId: string; scorerName: string }[] {
  const out: { scorerId: string; scorerName: string }[] = [];
  const isGoal = (text: string): boolean => /goal/i.test(text) && !/disallow|no goal|var/i.test(text);
  const fromArray = (arr: unknown): void => {
    for (const ev of (arr as Json[]) ?? []) {
      const text = get<string>(ev, 'type', 'text') ?? get<string>(ev, 'text') ?? '';
      if (!isGoal(text)) continue;
      const ath =
        get<Json[]>(ev, 'athletesInvolved') ?? get<Json[]>(ev, 'participants') ?? [];
      const a = ath[0];
      const id = a ? (get<string | number>(a, 'id') ?? get<string | number>(a, 'athlete', 'id')) : undefined;
      const name =
        (a && (get<string>(a, 'displayName') ?? get<string>(a, 'athlete', 'displayName'))) ?? 'Unknown';
      if (id != null) out.push({ scorerId: String(id), scorerName: name });
    }
  };
  fromArray(get(summary, 'keyEvents'));
  if (out.length === 0) fromArray(get(summary, 'scoringPlays'));
  return out;
}

export interface MatchFirstGoal {
  date: string; // ISO
  homeName: string;
  awayName: string;
  /** First goal: which ESPN side scored + the scorer. null = finished 0-0 (no goals). */
  first: { side: 'HOME' | 'AWAY'; scorerId: string; scorerName: string } | null;
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
              if (id != null && name) players.push({ id: String(id), name, team: teamName });
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
          if (state !== 'post') continue; // finished only
          const comp = (get<Json[]>(e, 'competitions') ?? [])[0];
          if (!comp) continue;
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
          const goal = (get<Json[]>(comp, 'details') ?? []).find((d) => get<boolean>(d, 'scoringPlay') === true);
          let first: MatchFirstGoal['first'] = null;
          if (goal) {
            const teamId = String(get<string | number>(goal, 'team', 'id') ?? '');
            const ath = (get<Json[]>(goal, 'athletesInvolved') ?? [])[0];
            const scorerId = ath ? String(get<string | number>(ath, 'id') ?? '') : '';
            const scorerName = (ath && get<string>(ath, 'displayName')) ?? 'Unknown';
            const side = sideById.get(teamId);
            if (side && scorerId) first = { side, scorerId, scorerName };
          }
          result.push({ date: get<string>(e, 'date') ?? date, homeName, awayName, first });
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
          try {
            const summary = await json(`${BASE}/summary?event=${id}`);
            result.push({ eventId: id, date: get<string>(e, 'date') ?? date, goals: extractGoals(summary) });
          } catch (err) {
            logger.warn('espn summary failed', { eventId: id, error: err instanceof Error ? err.message : 'unknown' });
          }
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
