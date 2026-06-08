import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Prediction } from '@wc2026/shared';
import { api, type MatchView } from '../api/client';
import { MatchCard } from '../components/MatchCard';
import { stageLabel } from '../lib/format';

export function FixturesPage() {
  const qc = useQueryClient();
  const matches = useQuery({ queryKey: ['matches'], queryFn: api.matches });
  const predictions = useQuery({ queryKey: ['my-predictions'], queryFn: api.myPredictions });

  const save = useMutation({
    mutationFn: ({ matchId, home, away }: { matchId: string; home: number; away: number }) =>
      api.upsertPrediction(matchId, home, away),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['my-predictions'] }),
  });

  const predByMatch = useMemo(() => {
    const map = new Map<string, Prediction>();
    for (const p of predictions.data ?? []) map.set(p.matchId, p);
    return map;
  }, [predictions.data]);

  const groups = useMemo(() => groupByStage(matches.data ?? []), [matches.data]);

  if (matches.isLoading) return <p>Loading fixtures…</p>;
  if (matches.isError) return <p className="error">Could not load fixtures. Is the API running?</p>;

  return (
    <div className="fixtures">
      <h2>Fixtures</h2>
      {save.isError && <p className="error">Could not save — the match may have started.</p>}
      {groups.map(([label, list]) => (
        <section key={label}>
          <h3 className="stage-header">{label}</h3>
          <div className="match-grid">
            {list.map((m) => (
              <MatchCard
                key={m.id}
                match={m}
                prediction={predByMatch.get(m.id)}
                saving={save.isPending}
                onSave={(matchId, home, away) => save.mutate({ matchId, home, away })}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function groupByStage(matches: MatchView[]): [string, MatchView[]][] {
  const order = ['GROUP_STAGE', 'LAST_32', 'LAST_16', 'QUARTER_FINALS', 'SEMI_FINALS', 'THIRD_PLACE', 'FINAL'];
  const byLabel = new Map<string, MatchView[]>();
  for (const m of matches) {
    const label = stageLabel(m.stage, m.groupName);
    const list = byLabel.get(label) ?? [];
    list.push(m);
    byLabel.set(label, list);
  }
  return [...byLabel.entries()].sort(
    (a, b) => order.indexOf(stageOf(a[1])) - order.indexOf(stageOf(b[1])) || a[0].localeCompare(b[0]),
  );
}

function stageOf(list: MatchView[]): string {
  return list[0]?.stage ?? 'GROUP_STAGE';
}
