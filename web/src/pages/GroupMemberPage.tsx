import { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { Flag } from '../components/Flag';
import { Avatar } from '../components/Avatar';

/** A group member's picks vs results (read-only). Pre-lock picks of others stay hidden by the API. */
export function GroupMemberPage() {
  const { id = '', pid = '' } = useParams();
  const matches = useQuery({ queryKey: ['matches'], queryFn: api.matches });
  const members = useQuery({ queryKey: ['members', id], queryFn: () => api.members(id) });
  const breakdown = useQuery({ queryKey: ['breakdown', id, pid], queryFn: () => api.groupBreakdown(id, pid) });

  const name = members.data?.find((m) => m.id === pid)?.name ?? 'Player';
  const matchById = useMemo(
    () => new Map((matches.data ?? []).map((m) => [m.id, m])),
    [matches.data],
  );

  const rows = useMemo(() => {
    const list = (breakdown.data ?? []).slice();
    list.sort((a, b) => (matchById.get(b.matchId)?.kickoff ?? '').localeCompare(matchById.get(a.matchId)?.kickoff ?? ''));
    return list;
  }, [breakdown.data, matchById]);

  const total = rows.reduce((s, r) => s + r.points, 0);

  return (
    <div className="member-page">
      <p><Link to={`/groups/${id}`}>← Group</Link></p>
      <div className="member-head">
        <Avatar name={name} size={40} ring />
        <h2>{name}</h2>
        <span className="member-total">{total} pts</span>
      </div>

      {breakdown.isLoading && <p>Loading…</p>}
      {!breakdown.isLoading && rows.length === 0 && <p className="muted">No predictions yet.</p>}

      <div className="member-results">
        {rows.map((r) => {
          const m = matchById.get(r.matchId);
          const hidden = r.home == null;
          const played = m?.homeScore != null && m?.awayScore != null;
          return (
            <div className="mr-row" key={r.matchId}>
              <span className="mr-teams">
                <Flag code={m?.homeCode ?? null} name={m?.homeTeam ?? ''} />
                <b>{m?.homeCode ?? '?'}</b>
                <span className="muted">v</span>
                <b>{m?.awayCode ?? '?'}</b>
                <Flag code={m?.awayCode ?? null} name={m?.awayTeam ?? ''} />
              </span>
              <span className="mr-pick">{hidden ? <span className="muted">🔒 hidden</span> : `${r.home}–${r.away}`}</span>
              <span className="mr-actual muted">{played ? `${m!.homeScore}–${m!.awayScore}` : '·'}</span>
              <span className={`mr-pts${r.points > 0 ? ' got' : ''}`}>{r.points > 0 ? `+${r.points}` : played ? '0' : ''}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
