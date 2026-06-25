import { useEffect, useState } from 'react';

/** Eases a number up from 0 when it first appears — points feel earned, not printed. */
export function useCountUp(target: number, active: boolean): number {
  const [v, setV] = useState(active ? 0 : target);
  useEffect(() => {
    if (!active || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setV(target);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const dur = 750;
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / dur);
      setV(Math.round(target * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, active]);
  return v;
}
