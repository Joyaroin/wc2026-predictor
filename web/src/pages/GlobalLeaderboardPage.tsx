import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api, type LeaderboardRow } from '../api/client';
import { usePlayer } from '../context/PlayerContext';
import { LeaderboardTable } from '../components/LeaderboardTable';

export function GlobalLeaderboardPage() {
  const { player } = usePlayer();
  const navigate = useNavigate();
  const q = useQuery({ queryKey: ['global-leaderboard'], queryFn: api.globalLeaderboard });

  const meInTop = q.data?.top.some((r) => r.playerId === player?.playerId);
  const openPlayer = (row: LeaderboardRow) => navigate(`/players/${row.playerId}`, { state: { name: row.name, color: row.avatarColor } });

  return (
    <div className="global-leaderboard">
      <h2>🌍 Global leaderboard</h2>
      {q.isLoading && <p>Loading…</p>}
      {q.data && (
        <>
          <p className="muted">{q.data.total} player{q.data.total === 1 ? '' : 's'} · top {q.data.top.length}</p>
          <LeaderboardTable rows={q.data.top} meId={player?.playerId ?? ''} onRowClick={openPlayer} />

          {q.data.me && !meInTop && (
            <>
              <p className="muted" style={{ textAlign: 'center', margin: '8px 0' }}>…</p>
              <LeaderboardTable rows={[q.data.me]} meId={player?.playerId ?? ''} onRowClick={openPlayer} />
            </>
          )}

          {q.data.total === 0 && <p className="muted">No predictions scored yet.</p>}
          <p className="muted fine gd-hint">Tap a player to see their past picks.</p>
        </>
      )}
    </div>
  );
}
