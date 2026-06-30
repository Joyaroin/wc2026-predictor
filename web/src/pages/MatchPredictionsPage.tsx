import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { pointsLabel, pensLabel } from '../lib/format';
import { Flag } from '../components/Flag';
import { resultsRefetchInterval } from '../lib/liveRefetch';

/** Everyone's predictions for one match — switch between Global and each of your groups. */
export function MatchPredictionsPage() {
  const { mid = '', id = '' } = useParams(); // id present when arrived from a group
  const qc = useQueryClient();
  const groups = useQuery({ queryKey: ['groups'], queryFn: api.listGroups });
  const matches = useQuery({ queryKey: ['matches'], queryFn: api.matches, staleTime: 60_000 });
  const [scope, setScope] = useState<string>(id || 'global'); // 'global' or a groupId

  const view = useQuery({
    queryKey: ['match-preds', scope, mid],
    queryFn: () => (scope === 'global' ? api.globalMatchPredictions(mid) : api.matchPredictions(scope, mid)),
    // Live points per pick update during the match.
    refetchInterval: () => resultsRefetchInterval(qc),
  });

  const match = matches.data?.find((m) => m.id === mid);
  const list = groups.data ?? [];
  const rows = view.data?.predictions ?? [];

  return (
    <div className="match-detail">
      <p><Link to="/fixtures">← Fixtures</Link></p>

      {match && (
        <div className="mp-head">
          <span className="mp-team"><Flag code={match.homeCode} name={match.homeTeam} /> {match.homeCode ?? match.homeTeam}</span>
          <span className="mp-score">{view.data?.actual ? `${view.data.actual.home}–${view.data.actual.away}` : 'vs'}</span>
          <span className="mp-team"><Flag code={match.awayCode} name={match.awayTeam} /> {match.awayCode ?? match.awayTeam}</span>
        </div>
      )}
      {match && pensLabel(match) && <div className="mp-pens muted fine" style={{ textAlign: 'center' }}>{pensLabel(match)}</div>}
      <h2>Who picked what</h2>

      <div className="chat-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={scope === 'global'} className={scope === 'global' ? 'on' : ''} onClick={() => setScope('global')} data-testid="mp-tab-global">🌍 Global</button>
        {list.map((g) => (
          <button type="button" role="tab" key={g.id} aria-selected={scope === g.id} className={scope === g.id ? 'on' : ''} onClick={() => setScope(g.id)} data-testid={`mp-tab-${g.id}`}>{g.name}</button>
        ))}
      </div>

      {view.isLoading && <p className="muted">Loading…</p>}
      {view.data && !view.data.locked && (
        <p className="muted fine">Everyone's picks unlock at kick-off — only yours shows until then.</p>
      )}
      {view.data && view.data.locked && rows.length === 0 && (
        <p className="muted fine">No predictions for this match.</p>
      )}
      {rows.length > 0 && (
        <table className="predictions" data-testid="match-predictions">
          <thead>
            <tr><th>Player</th><th>Pick</th><th>Pts</th></tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.playerId}>
                <td>{p.name}</td>
                <td className="mp-pick">{p.home}–{p.away}</td>
                <td>{view.data?.actual ? pointsLabel(p.points) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
