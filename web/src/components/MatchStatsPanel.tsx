import { useQuery } from '@tanstack/react-query';
import { api, type MatchView, type MatchEvent } from '../api/client';
import { Flag } from './Flag';

/** Parse a stat value like "58%" or "12" to a number for the comparison bar; NaN if non-numeric. */
function num(v: string): number {
  const n = parseFloat(v.replace('%', ''));
  return Number.isFinite(n) ? n : NaN;
}

function evIcon(kind: MatchEvent['kind']): string {
  return kind === 'goal' || kind === 'pen' ? '⚽' : kind === 'yellow' ? '🟨' : kind === 'red' ? '🟥' : '🔄';
}

/** Lazily-loaded full match details from ESPN: timeline, box-score stats, where to watch. */
export function MatchStatsPanel({ match }: { match: MatchView }) {
  const live = match.status === 'IN_PLAY' || match.status === 'PAUSED';
  const q = useQuery({
    queryKey: ['match-stats', match.id],
    queryFn: () => api.matchStats(match.id),
    refetchInterval: live ? 30_000 : false,
    staleTime: live ? 15_000 : 5 * 60_000,
  });

  if (q.isLoading) return <div className="ms-panel ms-state muted fine">Loading match details…</div>;
  if (q.isError) return <div className="ms-panel ms-state muted fine">Couldn't load details right now.</div>;
  const s = q.data;
  if (!s || (s.stats.length === 0 && s.timeline.length === 0 && s.broadcasts.length === 0)) {
    return <div className="ms-panel ms-state muted fine">No detailed info available for this match yet.</div>;
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

      {s.timeline.length > 0 && (
        <div className="ms-timeline">
          {s.timeline.slice().reverse().map((e, i) => (
            <div className="ms-ev" key={i}>
              <span className="ms-ev-home">
                {e.side === 'HOME' && <><span className="ms-ev-text">{e.text}</span><span className="ms-ev-icon">{evIcon(e.kind)}</span><Flag code={match.homeCode} name={match.homeTeam} /></>}
              </span>
              <span className="ms-ev-clock">{e.clock}</span>
              <span className="ms-ev-away">
                {e.side !== 'HOME' && <><Flag code={match.awayCode} name={match.awayTeam} /><span className="ms-ev-icon">{evIcon(e.kind)}</span><span className="ms-ev-text">{e.text}</span></>}
              </span>
            </div>
          ))}
        </div>
      )}

      {s.stats.length > 0 && (
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
      )}

      {s.broadcasts.length > 0 && (
        <div className="ms-watch muted fine">📺 {s.broadcasts.join(' · ')}</div>
      )}
    </div>
  );
}
