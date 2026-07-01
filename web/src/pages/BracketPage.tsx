import { useEffect, useMemo, useRef, type CSSProperties } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Stage } from '@wc2026/shared';
import { api, type MatchView } from '../api/client';
import { matchesRefetchInterval } from '../lib/liveRefetch';
import { KO_ROUNDS, splitKnockoutBracket } from '../lib/bracket';
import { BracketMatch } from '../components/BracketMatch';

type BracketVars = CSSProperties & Record<`--${string}`, string | number>;

function slotFor(base: number, count: number, index: number): number {
  if (count <= 0) return 0;
  const span = base / count;
  return index * span * 2 + span - 1;
}

/** Two-sided knockout bracket: left half and right half converge on the Final in the centre. */
export function BracketPage() {
  const matches = useQuery({
    queryKey: ['matches'],
    queryFn: api.matches,
    refetchInterval: (q) => matchesRefetchInterval(q.state.data as MatchView[] | undefined),
  });

  const { left, right, center, total } = useMemo(() => splitKnockoutBracket(matches.data ?? []), [matches.data]);

  const scRef = useRef<HTMLDivElement>(null);
  // Start scrolled to the centre (the final) — the business end — then swipe outward.
  useEffect(() => {
    const el = scRef.current;
    if (el) el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
  }, [left.length, right.length, total]);

  if (matches.isLoading) return <div className="bracket"><h2>Knockout bracket</h2><p className="muted">Loading…</p></div>;
  if (matches.isError) return <div className="bracket"><h2>Knockout bracket</h2><p className="error">Couldn't load the bracket. Please try again.</p></div>;
  if (total === 0) return <div className="bracket"><h2>Knockout bracket</h2><p className="muted">The bracket appears once the knockouts are drawn.</p></div>;

  const short = (s: Stage) => KO_ROUNDS.find((r) => r.stage === s)?.short ?? s;
  const sideBase = Math.max(1, ...left.map((c) => c.matches.length), ...right.map((c) => c.matches.length));
  const bracketStyle = { '--br-slots': sideBase * 2, '--br-final-slot': sideBase - 1 } as BracketVars;
  const matchStyle = (count: number, index: number) => ({ '--slot': slotFor(sideBase, count, index) } as BracketVars);
  const joiners = (count: number) => {
    const items = [];
    for (let i = 0; i + 1 < count; i += 2) {
      items.push(
        <span
          key={`join-${i}`}
          className="br-join"
          style={{
            '--slot-a': slotFor(sideBase, count, i),
            '--slot-b': slotFor(sideBase, count, i + 1),
          } as BracketVars}
          aria-hidden
        />,
      );
    }
    return items;
  };
  const renderSideMatch = (m: MatchView, count: number, index: number) => (
    <BracketMatch key={m.id} match={m} style={matchStyle(count, index)} />
  );

  return (
    <div className="bracket">
      <h2>Knockout bracket</h2>
      <div className="br2" ref={scRef} style={bracketStyle}>
        {left.map((c) => (
          <div key={`L${c.stage}`} className={`br2-col side left ${c.matches.length > 1 ? 'multi' : 'single'}`}>
            <div className="br2-title">{short(c.stage)}</div>
            {c.matches.map((m, i) => renderSideMatch(m, c.matches.length, i))}
            {joiners(c.matches.length)}
          </div>
        ))}

        <div className="br2-col center">
          <div className="br2-trophy" aria-hidden>🏆</div>
          <div className="br2-title">Final</div>
          {center.final.map((m) => <BracketMatch key={m.id} match={m} className="br-final" />)}
          {center.third.length > 0 && (
            <>
              <div className="br2-title third">3rd</div>
              {center.third.map((m) => <BracketMatch key={m.id} match={m} className="br-third" />)}
            </>
          )}
        </div>

        {right.map((c) => (
          <div key={`R${c.stage}`} className={`br2-col side right ${c.matches.length > 1 ? 'multi' : 'single'}`}>
            <div className="br2-title">{short(c.stage)}</div>
            {c.matches.map((m, i) => renderSideMatch(m, c.matches.length, i))}
            {joiners(c.matches.length)}
          </div>
        ))}
      </div>
    </div>
  );
}
