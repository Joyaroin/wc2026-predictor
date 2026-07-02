const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

export interface LiveScoreEvent {
  type: 'score' | 'status' | 'minute';
  matchId: string;
  home: number | null;
  away: number | null;
  status: string;
  minute: number | null;
}

// Opens an EventSource to /api/live. EventSource auto-reconnects on transient drops;
// onError fires so the caller can lean on polling until the stream recovers. Returns a close fn.
export function openLiveStream(
  token: string,
  onEvent: (e: LiveScoreEvent) => void,
  onError: () => void,
): () => void {
  if (typeof EventSource === 'undefined') { onError(); return () => {}; }
  const es = new EventSource(`${BASE}/api/live?token=${encodeURIComponent(token)}`);
  const handler = (ev: MessageEvent) => {
    try { onEvent(JSON.parse(ev.data) as LiveScoreEvent); } catch { /* ignore malformed frame */ }
  };
  for (const type of ['score', 'status', 'minute']) es.addEventListener(type, handler as EventListener);
  es.onerror = () => onError();
  return () => es.close();
}
