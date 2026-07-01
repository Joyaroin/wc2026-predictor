import { useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Stage, Prediction } from '@wc2026/shared';
import { api, type MatchView } from '../api/client';
import { matchesRefetchInterval } from '../lib/liveRefetch';
import { KO_ROUNDS, predictedAdvancer } from '../lib/bracket';
import { BracketMatch } from '../components/BracketMatch';

// Rounds that feed the final from each side (outer → inner).
const SIDE_ROUNDS: Stage[] = ['LAST_32', 'LAST_16', 'QUARTER_FINALS', 'SEMI_FINALS'];

/** Two-sided knockout bracket: left half fans right, right half fans left, Final in the centre. */
export function BracketPage() {
  const matches = useQuery({
    queryKey: ['matches'],
    queryFn: api.matches,
    refetchInterval: (q) => matchesRefetchInterval(q.state.data as MatchView[] | undefined),
  });
  const predictions = useQuery({ queryKey: ['my-predictions'], queryFn: api.myPredictions });

  const predByMatch = useMemo(() => {
    const m = new Map<string, Prediction>();
    for (const p of predictions.data ?? []) m.set(p.matchId, p);
    return m;
  }, [predictions.data]);

  const { left, right, center } = useMemo(() => {
    const ko = (matches.data ?? []).filter((m) => m.stage !== 'GROUP_STAGE');
    // Bracket order ≈ fixture id order; first half of a round feeds the top/left semi, second the bottom/right.
    const byStage = (s: Stage) => ko.filter((m) => m.stage === s).slice().sort((a, b) => Number(a.id) - Number(b.id));
    const half = (arr: MatchView[], which: 'L' | 'R') => {
      const n = Math.ceil(arr.length / 2);
      return which === 'L' ? arr.slice(0, n) : arr.slice(n);
    };
    const leftCols = SIDE_ROUNDS.map((s) => ({ stage: s, matches: half(byStage(s), 'L') })).filter((c) => c.matches.length);
    const rightCols = [...SIDE_ROUNDS].reverse().map((s) => ({ stage: s, matches: half(byStage(s), 'R') })).filter((c) => c.matches.length);
    return { left: leftCols, right: rightCols, center: { final: byStage('FINAL'), third: byStage('THIRD_PLACE') } };
  }, [matches.data]);

  const scRef = useRef<HTMLDivElement>(null);
  // Start scrolled to the centre (the final) — the business end — then let the user swipe outward.
  useEffect(() => {
    const el = scRef.current;
    if (el) el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
  }, [left.length, right.length]);

  const render = (m: MatchView) => (
    <BracketMatch key={m.id} match={m} myAdvancer={predictedAdvancer(predByMatch.get(m.id))} />
  );
  const short = (s: Stage) => KO_ROUNDS.find((r) => r.stage === s)?.short ?? s;

  if (matches.isLoading) return <div className="bracket"><h2>Knockout bracket</h2><p className="muted">Loading…</p></div>;
  if (left.length === 0 && center.final.length === 0) {
    return <div className="bracket"><h2>Knockout bracket</h2><p className="muted">The bracket appears once the knockouts are drawn.</p></div>;
  }

  return (
    <div className="bracket">
      <h2>Knockout bracket</h2>
      <p className="muted fine">◦ = your pick to advance · ✓/✗ once decided · swipe to see both sides</p>

      <div className="br2" ref={scRef}>
        {left.map((c) => (
          <div key={`L${c.stage}`} className="br2-col side">
            <div className="br2-title">{short(c.stage)}</div>
            <div className="br2-matches">{c.matches.map(render)}</div>
          </div>
        ))}

        <div className="br2-col center">
          <div className="br2-trophy" aria-hidden>🏆</div>
          <div className="br2-title">Final</div>
          {center.final.map(render)}
          {center.third.length > 0 && (
            <>
              <div className="br2-title third">3rd place</div>
              {center.third.map(render)}
            </>
          )}
        </div>

        {right.map((c) => (
          <div key={`R${c.stage}`} className="br2-col side">
            <div className="br2-title">{short(c.stage)}</div>
            <div className="br2-matches">{c.matches.map(render)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
