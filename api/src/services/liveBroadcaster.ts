import type { MatchView } from './dtos';

export interface LiveEvent {
  type: 'score' | 'status' | 'minute';
  matchId: string;
  home: number | null;
  away: number | null;
  status: string;
  minute: number | null;
}

interface Snap { home: number | null; away: number | null; status: string; minute: number | null }

export interface LiveBroadcaster {
  start(): void;
  stop(): void;
  subscribe(fn: (e: LiveEvent) => void): () => void;
  tickOnce(): Promise<LiveEvent[]>;
}

// One instance per API process. Polls `list()` on an interval, diffs against the last
// snapshot, and pushes change events to all subscribers (the connected SSE clients).
export function createLiveBroadcaster(
  list: () => Promise<MatchView[]>,
  opts: { intervalMs?: number } = {},
): LiveBroadcaster {
  const intervalMs = opts.intervalMs ?? 5_000;
  const subs = new Set<(e: LiveEvent) => void>();
  let snap: Map<string, Snap> | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;

  function diff(m: MatchView, prev: Snap | undefined): LiveEvent[] {
    const base = { matchId: m.id, home: m.homeScore, away: m.awayScore, status: m.status, minute: m.minute ?? null };
    if (!prev) return [];
    const out: LiveEvent[] = [];
    if (prev.home !== m.homeScore || prev.away !== m.awayScore) out.push({ type: 'score', ...base });
    if (prev.status !== m.status) out.push({ type: 'status', ...base });
    if (prev.minute !== (m.minute ?? null)) out.push({ type: 'minute', ...base });
    return out;
  }

  function subscribe(fn: (e: LiveEvent) => void): () => void {
    const wasEmpty = subs.size === 0;
    subs.add(fn);
    if (wasEmpty) startInterval(); // reference-counted: first subscriber wakes the poller
    return () => {
      subs.delete(fn);
      if (subs.size === 0) stopInterval(); // last subscriber gone: stop polling Dynamo for nobody
    };
  }

  async function tickOnce(): Promise<LiveEvent[]> {
    let matches: MatchView[];
    try {
      matches = await list();
    } catch {
      return []; // skip this tick; keep last snapshot
    }
    // Merge into the prior snapshot rather than replacing it wholesale: matches absent this
    // tick keep their last-known values, so if one reappears later it diffs against that
    // instead of silently re-seeding (and swallowing whatever changed while it was gone).
    const next = new Map<string, Snap>(snap ?? []);
    const events: LiveEvent[] = [];
    for (const m of matches) {
      const prev = snap?.get(m.id);
      next.set(m.id, { home: m.homeScore, away: m.awayScore, status: m.status, minute: m.minute ?? null });
      if (snap) events.push(...diff(m, prev));
    }
    snap = next;
    for (const e of events) for (const fn of subs) fn(e);
    return events;
  }

  function startInterval(): void {
    if (timer) return;
    void tickOnce(); // seed immediately
    timer = setInterval(() => void tickOnce(), intervalMs);
    timer.unref?.();
  }

  function stopInterval(): void {
    if (timer) clearInterval(timer);
    timer = null;
  }

  // Public start()/stop() remain for explicit/test control and are idempotent, but in normal
  // operation nothing calls start() unconditionally any more — subscribe()/unsubscribe() alone
  // drive the interval so it never polls DynamoDB with zero connected SSE clients.
  function start(): void {
    startInterval();
  }

  function stop(): void {
    stopInterval();
  }

  return { subscribe, tickOnce, start, stop };
}
