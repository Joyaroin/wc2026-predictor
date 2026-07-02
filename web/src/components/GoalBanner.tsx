import { useEffect, useRef, useState } from 'react';
import { onGoal } from '../lib/liveStream';

// Transient broadcast banner: shows the latest goal for 4s. Fired from useLiveScores.
export function GoalBanner() {
  const [msg, setMsg] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    const off = onGoal((m) => {
      setMsg(m);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setMsg(null), 4_000);
    });
    return () => { off(); clearTimeout(timerRef.current); };
  }, []);
  if (!msg) return null;
  return <div className="goal-banner" role="status" aria-live="polite">{msg}</div>;
}
