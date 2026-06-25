import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { computeSections, SECTION_ORDER, sectionLabel, effectivePoints, type Prediction, type SectionKey } from '@wc2026/shared';
import { api, type MatchView } from '../api/client';
import { MatchCard } from '../components/MatchCard';
import { MatchGridSkeleton } from '../components/Skeleton';
import { matchesRefetchInterval, resultsRefetchInterval } from '../lib/liveRefetch';

/** No-op handlers — result cards are read-only (finished matches can't be edited). */
const noop = () => {};

/** "My results" — every finished match as a read-only card, filterable by match week / round. */
export function MyBreakdownPage() {
  const qc = useQueryClient();
  const matches = useQuery({
    queryKey: ['matches'],
    queryFn: api.matches,
    refetchInterval: (query) => matchesRefetchInterval(query.state.data as MatchView[] | undefined),
  });
  // Points are recomputed server-side as results land — poll while live so totals update live.
  const predictions = useQuery({ queryKey: ['my-predictions'], queryFn: api.myPredictions, refetchInterval: () => resultsRefetchInterval(qc) });

  const sectionById = useMemo(() => computeSections(matches.data ?? []), [matches.data]);

  const predByMatch = useMemo(() => {
    const map = new Map<string, Prediction>();
    for (const p of predictions.data ?? []) map.set(p.matchId, p);
    return map;
  }, [predictions.data]);

  const finished = useMemo(
    () => (matches.data ?? []).filter((m) => m.status === 'FINISHED'),
    [matches.data],
  );

  // Only offer filters for sections that actually have finished matches.
  const presentSections = useMemo(
    () => SECTION_ORDER.filter((k) => finished.some((m) => sectionById.get(m.id) === k)),
    [finished, sectionById],
  );

  const [filter, setFilter] = useState<SectionKey | 'ALL'>('ALL');
  const active: SectionKey | 'ALL' = filter !== 'ALL' && presentSections.includes(filter) ? filter : 'ALL';

  const shown = useMemo(() => {
    const list = active === 'ALL' ? finished : finished.filter((m) => sectionById.get(m.id) === active);
    // Newest result first.
    return list.slice().sort((a, b) => b.kickoff.localeCompare(a.kickoff));
  }, [finished, active, sectionById]);

  const total = (predictions.data ?? []).reduce((s, p) => s + effectivePoints(p), 0);
  const exacts = (predictions.data ?? []).filter((p) => p.exact).length;

  if (matches.isLoading || predictions.isLoading) {
    return (
      <div className="results">
        <h2>My results</h2>
        <MatchGridSkeleton count={4} />
      </div>
    );
  }

  return (
    <div className="results">
      <h2>My results</h2>
      <p className="results-summary">
        <span className="total" data-testid="total-points">Total <strong>{total}</strong> pts</span>
        <span className="muted"> · {exacts} exact {exacts === 1 ? 'score' : 'scores'} · {finished.length} played</span>
      </p>

      {finished.length === 0 ? (
        <p className="muted">No finished matches yet — they'll appear here as cards once games are played.</p>
      ) : (
        <>
          <div className="results-filter" role="group" aria-label="Filter results">
            <button className={`filter-chip ${active === 'ALL' ? 'on' : ''}`} onClick={() => setFilter('ALL')} data-testid="filter-ALL">
              All
            </button>
            {presentSections.map((k) => (
              <button
                key={k}
                className={`filter-chip ${active === k ? 'on' : ''}`}
                onClick={() => setFilter(k)}
                data-testid={`filter-${k}`}
              >
                {sectionLabel(k)}
              </button>
            ))}
          </div>

          <div className="match-grid" data-testid="results-grid">
            {shown.map((m) => (
              <MatchCard
                key={m.id}
                match={m}
                prediction={predByMatch.get(m.id)}
                squad={[]}
                saving={false}
                onSave={noop}
                onClear={noop}
                onJoker={noop}
                onFirstTeam={noop}
                onFirstScorer={noop}
                onStatPick={noop}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
