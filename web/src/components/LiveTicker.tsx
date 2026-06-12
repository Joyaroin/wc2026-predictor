import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api, type MatchView } from '../api/client';
import { Flag } from './Flag';
import { liveMinute } from '../lib/format';

/** Broadcast-style strip under the nav while matches are in play; tap to jump to Fixtures. */
export function LiveTicker() {
  const q = useQuery({
    queryKey: ['matches'],
    queryFn: api.matches,
    refetchInterval: (query) => {
      const d = query.state.data as MatchView[] | undefined;
      return d?.some((m) => m.status === 'IN_PLAY' || m.status === 'PAUSED') ? 30_000 : 60_000;
    },
  });
  const live = (q.data ?? []).filter((m) => m.status === 'IN_PLAY' || m.status === 'PAUSED');
  if (live.length === 0) return null;

  return (
    <Link to="/fixtures" className="ticker" data-testid="live-ticker">
      <span className="ticker-live"><span className="live-dot">●</span> LIVE</span>
      <span className="ticker-items">
        {live.map((m) => (
          <span key={m.id} className="ticker-item">
            <Flag code={m.homeCode} name={m.homeTeam} /> {m.homeCode}
            <b> {m.homeScore ?? 0}–{m.awayScore ?? 0} </b>
            {m.awayCode} <Flag code={m.awayCode} name={m.awayTeam} />
            {liveMinute(m) && <span className="ticker-min">{liveMinute(m)}</span>}
          </span>
        ))}
      </span>
    </Link>
  );
}
