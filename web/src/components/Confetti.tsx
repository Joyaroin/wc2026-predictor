import { useMemo } from 'react';

const COLORS = ['#00c389', '#ffd24a', '#ff6b6b', '#5b8cff', '#f47a20', '#a78bfa'];

/** A short celebratory burst clipped to the parent card (hidden under prefers-reduced-motion). */
export function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.5,
        dur: 1.6 + Math.random() * 1.4,
        color: COLORS[i % COLORS.length]!,
        rot: Math.random() * 360,
        w: 5 + Math.random() * 5,
      })),
    [],
  );
  return (
    <div className="confetti" aria-hidden>
      {pieces.map((p, i) => (
        <span
          key={i}
          style={{
            left: `${p.left}%`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.dur}s`,
            background: p.color,
            width: p.w,
            height: p.w * 0.45,
            transform: `rotate(${p.rot}deg)`,
          }}
        />
      ))}
    </div>
  );
}
