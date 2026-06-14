import type { LeaderboardRow } from '../api/client';
import { Avatar } from './Avatar';
import { medal } from '../lib/rank';

export function LeaderboardTable({
  rows,
  meId,
  onRowClick,
}: {
  rows: LeaderboardRow[];
  meId: string;
  onRowClick?: (row: LeaderboardRow) => void;
}) {
  return (
    <div className="lb" data-testid="leaderboard">
      {rows.map((r, i) => (
        <button
          type="button"
          key={r.playerId}
          className={`lb-row${r.playerId === meId ? ' me' : ''}${onRowClick ? ' clickable' : ''}`}
          style={{ animationDelay: `${Math.min(i, 12) * 35}ms` }}
          onClick={() => onRowClick?.(r)}
          data-testid={`lb-row-${r.playerId}`}
        >
          <span className={`lb-rank${r.rank <= 3 ? ' top' : ''}`}>{medal(r.rank)}</span>
          <Avatar name={r.name} size={30} />
          <span className="lb-name">
            {r.name}
            {r.playerId === meId && <span className="lb-you">You</span>}
          </span>
          {r.exacts > 0 && <span className="lb-pill" title="Exact scorelines">{r.exacts}× exact</span>}
          <span className="lb-pts">{r.points}</span>
        </button>
      ))}
    </div>
  );
}
