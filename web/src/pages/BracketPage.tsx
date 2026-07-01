import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Stage, Prediction } from '@wc2026/shared';
import { api, type MatchView } from '../api/client';
import { matchesRefetchInterval } from '../lib/liveRefetch';
import { KO_ROUNDS, predictedAdvancer } from '../lib/bracket';
import { BracketMatch } from '../components/BracketMatch';

/** Knockout bracket: mobile = one round at a time (chips + list); desktop = rounds as columns. */
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

  const byRound = useMemo(() => {
    const ko = (matches.data ?? []).filter((m) => m.stage !== 'GROUP_STAGE');
    const map = new Map<Stage, MatchView[]>();
    for (const r of KO_ROUNDS) {
      map.set(r.stage, ko.filter((m) => m.stage === r.stage).slice().sort((a, b) => a.kickoff.localeCompare(b.kickoff)));
    }
    return map;
  }, [matches.data]);

  const rounds = KO_ROUNDS.filter((r) => (byRound.get(r.stage)?.length ?? 0) > 0);

  // Default to the earliest round that still has an unfinished match; else the last round.
  const defaultStage = useMemo<Stage | undefined>(() => {
    for (const r of rounds) {
      if ((byRound.get(r.stage) ?? []).some((m) => m.status !== 'FINISHED')) return r.stage;
    }
    return rounds[rounds.length - 1]?.stage;
  }, [rounds, byRound]);

  const [sel, setSel] = useState<Stage | null>(null);
  const active = sel ?? defaultStage;

  const render = (m: MatchView) => (
    <BracketMatch key={m.id} match={m} myAdvancer={predictedAdvancer(predByMatch.get(m.id))} />
  );

  if (matches.isLoading) return <div className="bracket"><h2>Knockout bracket</h2><p className="muted">Loading…</p></div>;
  if (rounds.length === 0) {
    return (
      <div className="bracket">
        <h2>Knockout bracket</h2>
        <p className="muted">The bracket appears once the group stage is done and the knockouts are drawn.</p>
      </div>
    );
  }

  return (
    <div className="bracket">
      <h2>Knockout bracket</h2>
      <p className="muted fine">◦ marks who you predicted to advance; ✓/✗ shows if they did.</p>

      {/* Mobile: round chips + a single round's list */}
      <div className="br-rounds" role="tablist" aria-label="Round">
        {rounds.map((r) => (
          <button
            key={r.stage}
            type="button"
            role="tab"
            aria-selected={active === r.stage}
            className={`br-chip${active === r.stage ? ' on' : ''}`}
            onClick={() => setSel(r.stage)}
            data-testid={`br-round-${r.stage}`}
          >
            {r.short}
          </button>
        ))}
      </div>
      <div className="br-list">{active && (byRound.get(active) ?? []).map(render)}</div>

      {/* Desktop: every round as a column */}
      <div className="br-cols">
        {rounds.map((r) => (
          <div key={r.stage} className="br-col">
            <div className="br-col-title">{r.label}</div>
            {(byRound.get(r.stage) ?? []).map(render)}
          </div>
        ))}
      </div>
    </div>
  );
}
