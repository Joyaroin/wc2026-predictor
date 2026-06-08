import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { usePlayer } from '../context/PlayerContext';

export function GlobalLeaderboardPage() {
  const { player } = usePlayer();
  const q = useQuery({ queryKey: ['global-leaderboard'], queryFn: api.globalLeaderboard });

  const meInTop = q.data?.top.some((r) => r.playerId === player?.playerId);

  return (
    <div className="global-leaderboard">
      <h2>🌍 Global leaderboard</h2>
      {q.isLoading && <p>Loading…</p>}
      {q.data && (
        <>
          <p className="muted">{q.data.total} player{q.data.total === 1 ? '' : 's'} · top {q.data.top.length}</p>
          <table className="leaderboard" data-testid="global-leaderboard">
            <thead>
              <tr><th>#</th><th>Player</th><th>Pts</th><th>Exact</th></tr>
            </thead>
            <tbody>
              {q.data.top.map((r) => (
                <tr key={r.playerId} className={r.playerId === player?.playerId ? 'me' : ''}>
                  <td>{r.rank}</td>
                  <td>{r.name}</td>
                  <td>{r.points}</td>
                  <td>{r.exacts}</td>
                </tr>
              ))}
              {q.data.me && !meInTop && (
                <>
                  <tr><td colSpan={4} className="muted" style={{ textAlign: 'center' }}>…</td></tr>
                  <tr className="me" data-testid="my-global-rank">
                    <td>{q.data.me.rank}</td>
                    <td>{q.data.me.name}</td>
                    <td>{q.data.me.points}</td>
                    <td>{q.data.me.exacts}</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
          {q.data.total === 0 && <p className="muted">No predictions scored yet.</p>}
        </>
      )}
    </div>
  );
}
