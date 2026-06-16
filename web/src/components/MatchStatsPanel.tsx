import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, type MatchView, type MatchEvent, type TeamLineup } from '../api/client';
import { Flag } from './Flag';

function num(v: string): number {
  const n = parseFloat(v.replace('%', ''));
  return Number.isFinite(n) ? n : NaN;
}

function evIcon(kind: MatchEvent['kind']): string {
  return kind === 'goal' || kind === 'pen' ? '⚽' : kind === 'yellow' ? '🟨' : kind === 'red' ? '🟥' : '🔄';
}

function LineupCol({ code, name, lineup }: { code: string | null; name: string; lineup: TeamLineup }) {
  return (
    <div className="lu-col">
      <div className="lu-head">
        <Flag code={code} name={name} /> <b>{code ?? name}</b>
        {lineup.formation && <span className="lu-form">{lineup.formation}</span>}
      </div>
      <ol className="lu-list">
        {lineup.starters.map((p, i) => (
          <li key={i}>
            <span className="lu-num">{p.number ?? '–'}</span>
            <span className="lu-name">{p.name}</span>
            {p.position && <span className="lu-pos">{p.position}</span>}
          </li>
        ))}
      </ol>
      {lineup.bench.length > 0 && (
        <>
          <div className="lu-sub">Bench</div>
          <ul className="lu-list bench">
            {lineup.bench.map((p, i) => (
              <li key={i}>
                <span className="lu-num">{p.number ?? '–'}</span>
                <span className="lu-name">{p.name}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

/** Lazily-loaded full match details from ESPN: timeline, stats, where to watch, and lineups. */
export function MatchStatsPanel({ match }: { match: MatchView }) {
  const live = match.status === 'IN_PLAY' || match.status === 'PAUSED';
  const pre = !live && match.status !== 'FINISHED';
  const q = useQuery({
    queryKey: ['match-stats', match.id],
    queryFn: () => api.matchStats(match.id),
    refetchInterval: live ? 30_000 : false,
    staleTime: live ? 15_000 : pre ? 2 * 60_000 : 5 * 60_000,
  });
  const [tab, setTab] = useState<'details' | 'lineups'>(pre ? 'lineups' : 'details');

  if (q.isLoading) return <div className="ms-panel ms-state muted fine">Loading match details…</div>;
  if (q.isError) return <div className="ms-panel ms-state muted fine">Couldn't load details right now.</div>;
  const s = q.data;
  if (!s) return <div className="ms-panel ms-state muted fine">No detailed info available for this match yet.</div>;

  const hasDetails = s.stats.length > 0 || s.timeline.length > 0 || s.broadcasts.length > 0;
  const hasLineups = !!s.lineups.home || !!s.lineups.away;

  return (
    <div className="ms-panel" data-testid={`stats-panel-${match.id}`}>
      {(s.venue || s.status) && (
        <div className="ms-meta muted fine">
          {s.status && <span>{s.status}</span>}
          {s.status && s.venue && <span> · </span>}
          {s.venue && <span>📍 {s.venue}</span>}
        </div>
      )}

      <div className="ms-tabs" role="tablist">
        <button type="button" className={tab === 'details' ? 'on' : ''} onClick={() => setTab('details')} data-testid={`tab-details-${match.id}`}>Timeline & stats</button>
        <button type="button" className={tab === 'lineups' ? 'on' : ''} onClick={() => setTab('lineups')} data-testid={`tab-lineups-${match.id}`}>Lineups</button>
      </div>

      {tab === 'details' && (
        !hasDetails ? (
          <div className="ms-state muted fine">No match data yet.</div>
        ) : (
          <>
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
            {s.broadcasts.length > 0 && <div className="ms-watch muted fine">📺 {s.broadcasts.join(' · ')}</div>}
          </>
        )
      )}

      {tab === 'lineups' && (
        !hasLineups ? (
          <div className="ms-state muted fine">Lineups drop ~1 hour before kick-off — check back soon.</div>
        ) : (
          <div className="ms-lineups">
            {s.lineups.home && <LineupCol code={match.homeCode} name={match.homeTeam} lineup={s.lineups.home} />}
            {s.lineups.away && <LineupCol code={match.awayCode} name={match.awayTeam} lineup={s.lineups.away} />}
          </div>
        )
      )}
    </div>
  );
}
