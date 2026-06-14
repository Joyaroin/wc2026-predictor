import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, type BreakdownRow } from '../api/client';
import { Flag } from './Flag';
import { Avatar } from './Avatar';

/** A player's picks vs results (read-only). Others' pre-lock picks arrive hidden from the API. */
export function PlayerResults({ name, rows, loading }: { name: string; rows: BreakdownRow[]; loading?: boolean }) {
  const matches = useQuery({ queryKey: ['matches'], queryFn: api.matches });
  const matchById = useMemo(
    () => new Map((matches.data ?? []).map((m) => [m.id, m])),
    [matches.data],
  );

  const sorted = useMemo(
    () => rows.slice().sort((a, b) => (matchById.get(b.matchId)?.kickoff ?? '').localeCompare(matchById.get(a.matchId)?.kickoff ?? '')),
    [rows, matchById],
  );
  const total = sorted.reduce((s, r) => s + r.points, 0);

  return (
    <>
      <div className="member-head">
        <Avatar name={name} size={40} ring />
        <h2>{name}</h2>
        <span className="member-total">{total} pts</span>
      </div>

      {loading && <p>Loading…</p>}
      {!loading && sorted.length === 0 && <p className="muted">No predictions yet.</p>}

      <div className="member-results">
        {sorted.map((r) => {
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
    </>
  );
}
