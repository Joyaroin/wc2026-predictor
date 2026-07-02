import { useEffect, useState } from 'react';
import type { MatchView } from '../api/client';
import { liveMinute } from '../lib/format';

const TICK_MS = 15_000;

// Ticks a live match's displayed minute forward between data syncs. Reuses the pure
// `liveMinute` formatter (provider minute when present, otherwise estimated from
// startedAt/kickoff) — this hook only supplies a fresh `now` so the kickoff-derived
// branch advances instead of freezing until the next poll/SSE update.
export function useLiveMinute(match: MatchView): string | null {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (match.status !== 'IN_PLAY') return;
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, [match.status]);

  return liveMinute(match, now);
}
