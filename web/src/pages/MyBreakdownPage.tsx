import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { effectivePoints } from '@wc2026/shared';
import { api, type MatchView } from '../api/client';
import { pointsLabel, matchState } from '../lib/format';

/** "My results" — your finished predictions newest-first, with running totals; upcoming picks tucked away. */
export function MyBreakdownPage() {
  const matches = useQuery({ queryKey: ['matches'], queryFn: api.matches });
  const predictions = useQuery({ queryKey: ['my-predictions'], queryFn: api.myPredictions });

  const matchById = useMemo(
    () => new Map((matches.data ?? []).map((m) => [m.id, m])),
    [matches.data],
  );

  const rows = useMemo(
    () =>
      (predictions.data ?? [])
        .map((p) => ({ pred: p, match: matchById.get(p.matchId) }))
        .filter((r): r is { pred: (typeof r)['pred']; match: MatchView } => !!r.match),
    [predictions.data, matchById],
  );

  // Played: newest first (most recent result on top). Pending: soonest kickoff first.
  const played = rows
    .filter((r) => matchState(r.match) === 'Played')
    .sort((a, b) => b.match.kickoff.localeCompare(a.match.kickoff));
  const pending = rows
    .filter((r) => matchState(r.match) !== 'Played')
    .sort((a, b) => a.match.kickoff.localeCompare(b.match.kickoff));

  const total = (predictions.data ?? []).reduce((s, p) => s + effectivePoints(p), 0);
  const exacts = (predictions.data ?? []).filter((p) => p.exact).length;

  const teams = (m: MatchView) => `${m.homeCode ?? m.homeTeam} v ${m.awayCode ?? m.awayTeam}`;

  if (matches.isLoading || predictions.isLoading) return <p>Loading your results…</p>;

  return (
    <div className="breakdown">
      <h2>My results</h2>
      <p className="results-summary">
        <span className="total" data-testid="total-points">Total <strong>{total}</strong> pts</span>
        <span className="muted"> · {exacts} exact {exacts === 1 ? 'score' : 'scores'} · {played.length} played</span>
      </p>

      {played.length > 0 ? (
        <table className="predictions" data-testid="results-played">
          <thead>
            <tr><th>Match</th><th>My pick</th><th>Result</th><th>Pts</th></tr>
          </thead>
          <tbody>
            {played.map(({ pred, match }) => (
              <tr key={pred.matchId} className={pred.exact ? 'exact-row' : undefined}>
                <td title={`${match.homeTeam} vs ${match.awayTeam}`}>{teams(match)}</td>
                <td>{pred.home}–{pred.away}{pred.joker ? ' ★' : ''}</td>
                <td><strong>{match.homeScore}–{match.awayScore}</strong></td>
                <td>{pointsLabel(pred.points, pred.exact)}{pred.joker ? ' ×2' : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="muted">No finished matches yet — your results will show up here as games are played.</p>
      )}

      {pending.length > 0 && (
        <details className="pending-picks">
          <summary>Yet to play ({pending.length})</summary>
          <table className="predictions">
            <tbody>
              {pending.map(({ pred, match }) => (
                <tr key={pred.matchId}>
                  <td title={`${match.homeTeam} vs ${match.awayTeam}`}>{teams(match)}</td>
                  <td>{pred.home}–{pred.away}{pred.joker ? ' ★' : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </div>
  );
}
