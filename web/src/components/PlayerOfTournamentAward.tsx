import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type WcPlayer } from '../api/client';
import { fold } from '../lib/search';

export function PlayerOfTournamentAward() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const status = useQuery({ queryKey: ['player-of-tournament'], queryFn: api.playerOfTournament });
  const pool = useQuery({ queryKey: ['player-pool'], queryFn: api.playerPool, staleTime: 60 * 60 * 1000 });

  const pick = useMutation({
    mutationFn: (p: WcPlayer) => api.setPlayerOfTournament(p.id, p.name),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['player-of-tournament'] }),
  });

  const matches = useMemo(() => {
    const q = fold(search.trim());
    if (q.length < 2) return [];
    return (pool.data ?? []).filter((p) => fold(p.name).includes(q) || fold(p.team).includes(q)).slice(0, 30);
  }, [search, pool.data]);

  const s = status.data;
  return (
    <section className="card award">
      <h2>⭐ Player of the Tournament</h2>
      <p className="muted fine">Predict the tournament's best player before kick-off. Correct = <b>+25</b> bonus points.</p>
      {s && (
        <>
          <div className="gb-row">
            <span className="muted">Your pick: </span>
            <strong>{s.pick ? s.pick.winnerName : '— none yet —'}</strong>
            {s.pick && s.pick.points > 0 && <span className="points"> +{s.pick.points}</span>}
          </div>
          <div className="gb-row">
            <span className="muted">Winner: </span>
            <strong>{s.winner ? s.winner.name : 'TBD'}</strong>
          </div>
          {s.locked ? (
            <p className="muted fine">🔒 Picks are locked — the tournament has started.</p>
          ) : (
            <div>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search a player or team…"
                data-testid="pott-search"
                disabled={pool.isLoading}
              />
              {pool.isLoading && <p className="muted">Loading squads…</p>}
              <ul className="gb-results">
                {matches.map((p) => (
                  <li key={p.id}>
                    <button className={s.pick?.winnerId === p.id ? 'pick on' : 'pick'} disabled={pick.isPending} onClick={() => pick.mutate(p)} data-testid={`pott-pick-${p.id}`}>
                      {p.name} <span className="muted fine">{p.team}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}
