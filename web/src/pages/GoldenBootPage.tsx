import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type WcPlayer } from '../api/client';

export function GoldenBootPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const status = useQuery({ queryKey: ['golden-boot'], queryFn: api.goldenBoot });
  const pool = useQuery({ queryKey: ['player-pool'], queryFn: api.playerPool, staleTime: 60 * 60 * 1000 });

  const pick = useMutation({
    mutationFn: (p: WcPlayer) => api.setGoldenBoot(p.id, p.name),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['golden-boot'] }),
  });

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q.length < 2) return [];
    return (pool.data ?? []).filter((p) => p.name.toLowerCase().includes(q) || p.team.toLowerCase().includes(q)).slice(0, 30);
  }, [search, pool.data]);

  const locked = status.data?.locked;
  const myPick = status.data?.pick;
  const leader = status.data?.leader;

  return (
    <div className="golden-boot">
      <h2>🥇 Golden Boot</h2>
      <p className="muted fine">Predict the <b>top scorer</b> of the tournament before kick-off. Correct pick = <b>+25</b> bonus points.</p>

      <div className="card">
        <div className="gb-row"><span className="muted">Your pick:</span> <strong>{myPick ? myPick.scorerName : '— none yet —'}</strong>{myPick && myPick.points > 0 && <span className="points"> +{myPick.points}</span>}</div>
        <div className="gb-row"><span className="muted">Current top scorer:</span> <strong>{leader ? `${leader.scorerName} (${leader.goals})` : 'TBD'}</strong></div>
        {locked && <p className="muted fine">🔒 Picks are locked — the tournament has started.</p>}
      </div>

      {!locked && (
        <div className="card">
          <label>
            Search a player or team
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="e.g. Mbappé, Brazil…"
              data-testid="gb-search"
              disabled={pool.isLoading}
            />
          </label>
          {pool.isLoading && <p className="muted">Loading squads…</p>}
          {search.trim().length >= 2 && matches.length === 0 && !pool.isLoading && <p className="muted">No players found.</p>}
          <ul className="gb-results">
            {matches.map((p) => (
              <li key={p.id}>
                <button
                  className={myPick?.scorerId === p.id ? 'pick on' : 'pick'}
                  disabled={pick.isPending}
                  onClick={() => pick.mutate(p)}
                  data-testid={`gb-pick-${p.id}`}
                >
                  {p.name} <span className="muted fine">{p.team}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
