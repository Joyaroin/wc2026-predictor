import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { effectivePoints } from '@wc2026/shared';
import { api } from '../api/client';
import { pointsLabel, matchState } from '../lib/format';

export function MyBreakdownPage() {
  const matches = useQuery({ queryKey: ['matches'], queryFn: api.matches });
  const predictions = useQuery({ queryKey: ['my-predictions'], queryFn: api.myPredictions });

  const matchById = useMemo(
    () => new Map((matches.data ?? []).map((m) => [m.id, m])),
    [matches.data],
  );

  const rows = (predictions.data ?? [])
    .map((p) => ({ pred: p, match: matchById.get(p.matchId) }))
    .filter((r) => r.match)
    .sort((a, b) => (a.match!.kickoff < b.match!.kickoff ? -1 : 1));

  const total = (predictions.data ?? []).reduce((s, p) => s + effectivePoints(p), 0);

  return (
    <div className="breakdown">
      <h2>My points</h2>
      <p className="total" data-testid="total-points">Total: <strong>{total}</strong></p>
      <table className="predictions">
        <thead>
          <tr><th>Match</th><th>My pick</th><th>Result</th><th>Pts</th></tr>
        </thead>
        <tbody>
          {rows.map(({ pred, match }) => {
            // The headline total sums effectivePoints over ALL predictions, including
            // live (running) points. Show the score + live points for Live rows too so
            // the visible rows reconcile with the total (otherwise Live rows showed '—').
            const state = matchState(match!);
            const settled = state === 'Played' || state === 'Live';
            const live = state === 'Live';
            return (
              <tr key={pred.matchId}>
                <td>{match!.homeTeam} vs {match!.awayTeam}</td>
                <td>{pred.home}–{pred.away}{pred.joker ? ' ★' : ''}</td>
                <td>
                  {settled ? `${match!.homeScore}–${match!.awayScore}` : '—'}
                  {live && <span className="muted fine"> ● live</span>}
                </td>
                <td>{settled ? `${pointsLabel(pred.points, pred.exact)}${pred.joker ? ' ×2' : ''}` : '—'}</td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr><td colSpan={4} className="muted">No predictions yet.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
