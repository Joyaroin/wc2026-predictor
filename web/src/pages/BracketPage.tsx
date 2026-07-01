import { useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Stage } from '@wc2026/shared';
import { api, type MatchView } from '../api/client';
import { matchesRefetchInterval } from '../lib/liveRefetch';
import { KO_ROUNDS } from '../lib/bracket';
import { BracketMatch } from '../components/BracketMatch';

// Rounds that feed the final from each side (outer → inner).
const SIDE_ROUNDS: Stage[] = ['LAST_32', 'LAST_16', 'QUARTER_FINALS', 'SEMI_FINALS'];

/** Two-sided knockout bracket: left half and right half converge on the Final in the centre. */
export function BracketPage() {
  const matches = useQuery({
    queryKey: ['matches'],
    queryFn: api.matches,
    refetchInterval: (q) => matchesRefetchInterval(q.state.data as MatchView[] | undefined),
  });

  const { left, right, center, total } = useMemo(() => {
    const ko = (matches.data ?? []).filter((m) => m.stage !== 'GROUP_STAGE');
    const byStage = (s: Stage) => ko.filter((m) => m.stage === s).slice().sort((a, b) => Number(a.id) - Number(b.id));
    // Split each round in half by fixture order: first half → left, second half → right (balanced).
    const half = (arr: MatchView[], w: 'L' | 'R') => {
      const n = Math.ceil(arr.length / 2);
      return w === 'L' ? arr.slice(0, n) : arr.slice(n);
    };
    const leftCols = SIDE_ROUNDS.map((s) => ({ stage: s, matches: half(byStage(s), 'L') })).filter((c) => c.matches.length);
    const rightCols = [...SIDE_ROUNDS].reverse().map((s) => ({ stage: s, matches: half(byStage(s), 'R') })).filter((c) => c.matches.length);
    return { left: leftCols, right: rightCols, center: { final: byStage('FINAL'), third: byStage('THIRD_PLACE') }, total: ko.length };
  }, [matches.data]);

  const scRef = useRef<HTMLDivElement>(null);
  // Start scrolled to the centre (the final) — the business end — then swipe outward.
  useEffect(() => {
    const el = scRef.current;
    if (el) el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
  }, [left.length, right.length, total]);

  if (matches.isLoading) return <div className="bracket"><h2>Knockout bracket</h2><p className="muted">Loading…</p></div>;
  if (matches.isError) return <div className="bracket"><h2>Knockout bracket</h2><p className="error">Couldn't load the bracket. Please try again.</p></div>;
  if (total === 0) return <div className="bracket"><h2>Knockout bracket</h2><p className="muted">The bracket appears once the knockouts are drawn.</p></div>;

  const render = (m: MatchView) => <BracketMatch key={m.id} match={m} />;
  const short = (s: Stage) => KO_ROUNDS.find((r) => r.stage === s)?.short ?? s;

  return (
    <div className="bracket">
      <h2>Knockout bracket</h2>
      <div className="br2" ref={scRef}>
        {left.map((c) => (
          <div key={`L${c.stage}`} className="br2-col side">
            <div className="br2-title">{short(c.stage)}</div>
            {c.matches.map(render)}
          </div>
        ))}

        <div className="br2-col center">
          <div className="br2-trophy" aria-hidden>🏆</div>
          <div className="br2-title">Final</div>
          {center.final.map(render)}
          {center.third.length > 0 && (
            <>
              <div className="br2-title third">3rd</div>
              {center.third.map(render)}
            </>
          )}
        </div>

        {right.map((c) => (
          <div key={`R${c.stage}`} className="br2-col side">
            <div className="br2-title">{short(c.stage)}</div>
            {c.matches.map(render)}
          </div>
        ))}
      </div>
    </div>
  );
}
