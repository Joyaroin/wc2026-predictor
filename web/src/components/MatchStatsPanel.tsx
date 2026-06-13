import { useQuery } from '@tanstack/react-query';
import { api, type MatchView } from '../api/client';

/** Parse a stat value like "58%" or "12" to a number for the comparison bar; NaN if non-numeric. */
function num(v: string): number {
  const n = parseFloat(v.replace('%', ''));
  return Number.isFinite(n) ? n : NaN;
}

/** Lazily-loaded box-score stats for a match from ESPN. */
export function MatchStatsPanel({ match }: { match: MatchView }) {
  const live = match.status === 'IN_PLAY' || match.status === 'PAUSED';
  const q = useQuery({
    queryKey: ['match-stats', match.id],
    queryFn: () => api.matchStats(match.id),
    refetchInterval: live ? 30_000 : false,
    staleTime: live ? 15_000 : 5 * 60_000,
  });

  if (q.isLoading) return <div className="ms-panel ms-state muted fine">Loading match stats…</div>;
  if (q.isError) return <div className="ms-panel ms-state muted fine">Couldn't load stats right now.</div>;
  const s = q.data;
  if (!s || s.stats.length === 0) {
    return <div className="ms-panel ms-state muted fine">No detailed stats available for this match yet.</div>;
  }

  return (
    <div className="ms-panel" data-testid={`stats-panel-${match.id}`}>
      {(s.venue || s.status) && (
        <div className="ms-meta muted fine">
          {s.status && <span>{s.status}</span>}
          {s.status && s.venue && <span> · </span>}
          {s.venue && <span>📍 {s.venue}</span>}
        </div>
      )}

      <div className="ms-stats">
        {s.stats.map((row) => {
          const h = num(row.home);
          const a = num(row.away);
          const total = h + a;
          const hPct = Number.isFinite(total) && total > 0 ? (h / total) * 100 : 50;
          const homeMore = Number.isFinite(h) && Number.isFinite(a) && h >= a;
          return (
            <div className="ms-stat-row" key={row.label}>
              <div className="ms-stat-vals">
                <span className={homeMore ? 'strong' : ''}>{row.home}</span>
                <span className="ms-stat-label">{row.label}</span>
                <span className={!homeMore ? 'strong' : ''}>{row.away}</span>
              </div>
              <div className="ms-bar">
                <span className="ms-bar-home" style={{ width: `${hPct}%` }} />
                <span className="ms-bar-away" style={{ width: `${100 - hPct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
