import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api, type MatchView } from '../api/client';
import { liveMinute } from '../lib/format';
import { Flag } from './Flag';

/** In-app live-score feed: a 🔔 in the nav that opens a list of in-play matches with their scores. */
export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const q = useQuery({
    queryKey: ['matches'],
    queryFn: api.matches,
    refetchInterval: (query) => {
      const data = query.state.data as MatchView[] | undefined;
      return data?.some((m) => m.status === 'IN_PLAY' || m.status === 'PAUSED') ? 30_000 : 60_000;
    },
  });

  const live = (q.data ?? []).filter((m) => m.status === 'IN_PLAY' || m.status === 'PAUSED');

  return (
    <div className="menu bell">
      <button
        className="menu-btn"
        onClick={() => setOpen((o) => !o)}
        aria-label="Live scores"
        aria-expanded={open}
        data-testid="nav-bell"
      >
        🔔{live.length > 0 && <span className="bell-badge" data-testid="bell-badge">{live.length}</span>}
      </button>
      {open && (
        <>
          <div className="menu-backdrop" onClick={() => setOpen(false)} />
          <div className="menu-dropdown right bell-dropdown" data-testid="bell-dropdown">
            <div className="bell-head">{live.length > 0 ? <><span className="live-dot">●</span> Live now</> : 'Live scores'}</div>
            {live.length === 0 ? (
              <div className="bell-empty muted fine">No live matches right now.</div>
            ) : (
              live.map((m) => (
                <Link to="/fixtures" className="bell-row" key={m.id} onClick={() => setOpen(false)} data-testid={`bell-row-${m.id}`}>
                  <Flag code={m.homeCode} name={m.homeTeam} />
                  <span className="bell-code">{m.homeCode ?? '?'}</span>
                  <b className="bell-score">{m.homeScore ?? 0}–{m.awayScore ?? 0}</b>
                  <span className="bell-code">{m.awayCode ?? '?'}</span>
                  <Flag code={m.awayCode} name={m.awayTeam} />
                  {liveMinute(m) && <span className="bell-min">{liveMinute(m)}</span>}
                </Link>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
