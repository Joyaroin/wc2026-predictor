import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { computeSections, SECTION_ORDER, sectionLabel, type Prediction } from '@wc2026/shared';
import { api, type MatchView } from '../api/client';
import { MatchCard } from '../components/MatchCard';
import { canonTeam } from '../lib/teams';

export function FixturesPage() {
  const qc = useQueryClient();
  const matches = useQuery({
    queryKey: ['matches'],
    queryFn: api.matches,
    refetchInterval: (query) => {
      const data = query.state.data as MatchView[] | undefined;
      return data?.some((m) => m.status === 'IN_PLAY' || m.status === 'PAUSED') ? 60_000 : false;
    },
  });
  const predictions = useQuery({ queryKey: ['my-predictions'], queryFn: api.myPredictions });
  const pool = useQuery({ queryKey: ['player-pool'], queryFn: api.playerPool, staleTime: 60 * 60 * 1000 });

  const squadByTeam = useMemo(() => {
    const map = new Map<string, { id: string; name: string; position: string }[]>();
    for (const p of pool.data ?? []) {
      const k = canonTeam(p.team);
      const list = map.get(k) ?? [];
      list.push({ id: p.id, name: p.name, position: p.position });
      map.set(k, list);
    }
    return map;
  }, [pool.data]);

  const save = useMutation({
    mutationFn: ({ matchId, home, away }: { matchId: string; home: number; away: number }) =>
      api.upsertPrediction(matchId, { home, away }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['my-predictions'] }),
  });
  const joker = useMutation({
    mutationFn: ({ matchId, on }: { matchId: string; on: boolean }) => api.setJoker(matchId, on),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['my-predictions'] }),
  });
  const firstTeam = useMutation({
    mutationFn: ({ matchId, home, away, side }: { matchId: string; home: number; away: number; side: 'HOME' | 'AWAY' | null }) =>
      api.upsertPrediction(matchId, { home, away, firstTeam: side }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['my-predictions'] }),
  });
  const firstScorer = useMutation({
    mutationFn: ({ matchId, home, away, scorerId, scorerName }: { matchId: string; home: number; away: number; scorerId: string | null; scorerName: string | null }) =>
      api.upsertPrediction(matchId, { home, away, firstScorerId: scorerId, firstScorerName: scorerName }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['my-predictions'] }),
  });

  const predByMatch = useMemo(() => {
    const map = new Map<string, Prediction>();
    for (const p of predictions.data ?? []) map.set(p.matchId, p);
    return map;
  }, [predictions.data]);

  const sections = useMemo(() => {
    const all = matches.data ?? [];
    const byId = computeSections(all);
    const byKey = new Map<string, MatchView[]>();
    for (const m of all) {
      const k = byId.get(m.id) ?? 'MW1';
      const list = byKey.get(k) ?? [];
      list.push(m);
      byKey.set(k, list);
    }
    return SECTION_ORDER.filter((k) => byKey.has(k)).map((k) => ({
      key: k,
      label: sectionLabel(k),
      isGroup: k.startsWith('MW'),
      matches: (byKey.get(k) ?? []).sort((a, b) => a.kickoff.localeCompare(b.kickoff)),
    }));
  }, [matches.data]);

  const activeKey = useMemo(() => {
    const active = sections.find((s) => s.matches.some((m) => m.status !== 'FINISHED'));
    return active?.key ?? sections[0]?.key;
  }, [sections]);
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const isOpen = (key: string) => overrides[key] ?? key === activeKey;
  const toggle = (key: string) => setOverrides((o) => ({ ...o, [key]: !(o[key] ?? key === activeKey) }));

  if (matches.isLoading) return <p>Loading fixtures…</p>;
  if (matches.isError) return <p className="error">Could not load fixtures. Is the API running?</p>;

  return (
    <div className="fixtures">
      <h2>Fixtures</h2>
      <p className="muted fine">★ Tip: set a <b>Joker</b> on one match per section (match week / round) to double its points.</p>
      {(save.isError || joker.isError) && <p className="error">Could not save — the match may have started.</p>}

      <div className="weeks">
        {sections.map((s) => {
          const open = isOpen(s.key);
          return (
            <section key={s.key} className={`week ${open ? 'open' : ''}`}>
              <button className="week-header" onClick={() => toggle(s.key)} aria-expanded={open} data-testid={`section-${s.key}`}>
                <span className="week-cal" aria-hidden>{s.isGroup ? '📅' : '🏆'}</span>
                <span className="week-title">{s.label}</span>
                <span className="week-sum muted fine">{s.matches.length} matches</span>
                <span className={`chevron ${open ? 'down' : ''}`} aria-hidden>▸</span>
              </button>
              {open && (
                <div className="match-grid">
                  {s.matches.map((m) => (
                    <MatchCard
                      key={m.id}
                      match={m}
                      prediction={predByMatch.get(m.id)}
                      saving={save.isPending || joker.isPending || firstTeam.isPending || firstScorer.isPending}
                      squad={[...(squadByTeam.get(canonTeam(m.homeTeam)) ?? []), ...(squadByTeam.get(canonTeam(m.awayTeam)) ?? [])]}
                      onSave={(matchId, home, away) => save.mutate({ matchId, home, away })}
                      onJoker={(matchId, on) => joker.mutate({ matchId, on })}
                      onFirstTeam={(matchId, side) => {
                        const p = predByMatch.get(matchId);
                        if (p) firstTeam.mutate({ matchId, home: p.home, away: p.away, side });
                      }}
                      onFirstScorer={(matchId, scorerId, scorerName) => {
                        const p = predByMatch.get(matchId);
                        if (p) firstScorer.mutate({ matchId, home: p.home, away: p.away, scorerId, scorerName });
                      }}
                    />
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
