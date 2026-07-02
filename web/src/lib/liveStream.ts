const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

export interface LiveScoreEvent {
  type: 'score' | 'status' | 'minute';
  matchId: string;
  home: number | null;
  away: number | null;
  status: string;
  minute: number | null;
}

// Pure: exponential backoff schedule for reconnect attempts, capped at 30s so a dead
// stream doesn't hammer the server (or itself) once the caller gives up retrying.
export function nextBackoffMs(attempt: number): number {
  return Math.min(30_000, 1_000 * 2 ** attempt);
}

const MAX_RECONNECT_ATTEMPTS = 6;

// Opens a managed EventSource to /api/live, fetching a fresh short-lived stream token
// on every (re)connect attempt instead of reusing the long-lived session token in the
// URL (avoids leaking it into server/proxy logs) and instead of relying on EventSource's
// native auto-reconnect (which retries every ~3s forever, even against an expired token —
// a reconnect storm). We own reconnect scheduling with exponential backoff and a cap;
// once exhausted, the caller's polling fallback keeps data fresh. Returns a close fn.
export function openLiveStream(
  fetchToken: () => Promise<string>,
  onEvent: (e: LiveScoreEvent) => void,
  onError?: () => void,
): () => void {
  let closed = false;
  let es: EventSource | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let attempt = 0;

  const scheduleReconnect = () => {
    if (closed) return;
    if (attempt >= MAX_RECONNECT_ATTEMPTS) {
      onError?.();
      return;
    }
    const delay = nextBackoffMs(attempt);
    attempt += 1;
    timer = setTimeout(() => { void connect(); }, delay);
  };

  const connect = async () => {
    if (closed) return;
    if (typeof EventSource === 'undefined') {
      onError?.();
      return;
    }
    let token: string;
    try {
      token = await fetchToken();
    } catch {
      onError?.();
      scheduleReconnect();
      return;
    }
    if (closed) return;

    const next = new EventSource(`${BASE}/api/live?token=${encodeURIComponent(token)}`);
    es = next;
    const handler = (ev: MessageEvent) => {
      try { onEvent(JSON.parse(ev.data) as LiveScoreEvent); } catch { /* ignore malformed frame */ }
    };
    for (const type of ['score', 'status', 'minute']) next.addEventListener(type, handler as EventListener);
    next.onopen = () => { attempt = 0; };
    next.onerror = () => {
      next.close();
      onError?.();
      scheduleReconnect();
    };
  };

  void connect();

  return () => {
    closed = true;
    if (timer) clearTimeout(timer);
    es?.close();
  };
}

// Transient goal broadcast bus: fired by useLiveScores when a score event represents a new
// goal, consumed by <GoalBanner/> to show a brief on-screen callout. Module-level so any
// number of banners/subscribers can attach without prop drilling through the app tree.
type GoalListener = (msg: string) => void;
const goalListeners = new Set<GoalListener>();
export function onGoal(fn: GoalListener): () => void {
  goalListeners.add(fn);
  return () => goalListeners.delete(fn);
}
export function emitGoal(msg: string): void {
  for (const fn of goalListeners) fn(msg);
}
