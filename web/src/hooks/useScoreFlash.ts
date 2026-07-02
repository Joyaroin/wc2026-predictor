import { useEffect, useRef, useState } from 'react';

type Pair = { h: number | null; a: number | null };

// Pure: has the scoreline changed since the previous render? False on the seed (prev null).
export function scoreChanged(prev: Pair | null, cur: Pair): boolean {
  if (prev === null) return false;
  return prev.h !== cur.h || prev.a !== cur.a;
}

// Returns true briefly when the scoreline changes (never on first render), so the card
// can play a goal-flash. Mirrors the ref-diff pattern used in LiveTicker for finished matches.
export function useScoreFlash(homeScore: number | null, awayScore: number | null): boolean {
  const prev = useRef<Pair | null>(null);
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    const cur: Pair = { h: homeScore, a: awayScore };
    const changed = scoreChanged(prev.current, cur);
    prev.current = cur;
    if (changed) {
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 900);
      return () => clearTimeout(t);
    }
  }, [homeScore, awayScore]);
  return flash;
}
