import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api, type MatchView } from '../api/client';
import { Flag } from './Flag';
import { liveMinute } from '../lib/format';
import { matchesRefetchInterval } from '../lib/liveRefetch';

/** Broadcast-style strip under the nav while matches are in play; tap to jump to Fixtures. */
export function LiveTicker() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['matches'],
    queryFn: api.matches,
    refetchInterval: (query) => matchesRefetchInterval(query.state.data as MatchView[] | undefined),
  });

  // The ticker is always mounted, so it's our global "a match just ended" detector: when any
  // match flips to FINISHED, refresh the result-derived data (leaderboards, points, who-picked)
  // so scoring appears immediately without a manual reload — wherever the user happens to be.
  const finishedIds = useRef<Set<string> | null>(null);
  useEffect(() => {
    const data = q.data;
    if (!data) return;
    const nowFinished = new Set(data.filter((m) => m.status === 'FINISHED').map((m) => m.id));
    if (finishedIds.current === null) { finishedIds.current = nowFinished; return; } // seed, don't fire on first load
    const newlyFinished = [...nowFinished].some((id) => !finishedIds.current!.has(id));
    finishedIds.current = nowFinished;
    if (newlyFinished) {
      void qc.invalidateQueries({ queryKey: ['global-leaderboard'] });
      void qc.invalidateQueries({ queryKey: ['leaderboard'] });
      void qc.invalidateQueries({ queryKey: ['my-predictions'] });
      void qc.invalidateQueries({ queryKey: ['match-preds'] });
    }
  }, [q.data, qc]);

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
