import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { pointsLabel } from '../lib/format';

export function MatchDetailPage() {
  const { id = '', mid = '' } = useParams();
  const view = useQuery({
    queryKey: ['match-predictions', id, mid],
    queryFn: () => api.matchPredictions(id, mid),
  });

  return (
    <div className="match-detail">
      <p><Link to={`/groups/${id}`}>← Group</Link></p>
      <h2>Match predictions</h2>
      {view.isLoading && <p>Loading…</p>}
      {view.data && !view.data.locked && (
        <p className="muted">Other members' picks are hidden until kickoff.</p>
      )}
      {view.data?.actual && (
        <p className="result">Result: <strong>{view.data.actual.home}–{view.data.actual.away}</strong></p>
      )}
      {view.data && (
        <table className="predictions" data-testid="match-predictions">
          <thead>
            <tr><th>Player</th><th>Pick</th><th>Pts</th></tr>
          </thead>
          <tbody>
            {view.data.predictions.map((p) => (
              <tr key={p.playerId}>
                <td>{p.name}</td>
                <td>{p.home != null && p.away != null ? `${p.home}–${p.away}` : '🔒 hidden'}</td>
                <td>{view.data?.actual ? pointsLabel(p.points) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
