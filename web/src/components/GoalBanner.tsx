import { useEffect, useState } from 'react';
import { onGoal } from '../lib/liveStream';

// Transient broadcast banner: shows the latest goal for 4s. Fired from useLiveScores.
export function GoalBanner() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    return onGoal((m) => {
      setMsg(m);
      const t = setTimeout(() => setMsg(null), 4_000);
      return () => clearTimeout(t);
    });
  }, []);
  if (!msg) return null;
  return <div className="goal-banner" role="status" aria-live="polite">{msg}</div>;
}
