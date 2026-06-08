import type { LeaderboardRow } from '../api/client';

export function LeaderboardTable({ rows, meId }: { rows: LeaderboardRow[]; meId: string }) {
  return (
    <table className="leaderboard" data-testid="leaderboard">
      <thead>
        <tr>
          <th>#</th>
          <th>Player</th>
          <th>Pts</th>
          <th>Exact</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.playerId} className={r.playerId === meId ? 'me' : ''} data-testid={`lb-row-${r.playerId}`}>
            <td>{r.rank}</td>
            <td>{r.name}</td>
            <td>{r.points}</td>
            <td>{r.exacts}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
