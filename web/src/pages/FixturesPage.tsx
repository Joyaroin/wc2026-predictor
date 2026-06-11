import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { computeSections, SECTION_ORDER, sectionLabel, type Prediction } from '@wc2026/shared';
import { api, type MatchView } from '../api/client';
import { MatchCard } from '../components/MatchCard';
import { canonTeam } from '../lib/teams';

const PREDS = ['my-predictions'] as const;

/** Optimistically patch the cached predictions list; returns the previous list for rollback. */
function patchPreds(qc: QueryClient, fn: (old: Prediction[]) => Prediction[]): Prediction[] | undefined {
  const prev = qc.getQueryData<Prediction[]>(PREDS as unknown as string[]);
  qc.setQueryData<Prediction[]>(PREDS as unknown as string[], (old) => fn(old ?? []));
  return prev;
}

export function FixturesPage() {
  const qc = useQueryClient();
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  const matches = useQuery({
    queryKey: ['matches'],
    queryFn: api.matches,
    // Always poll so the page flips to LIVE at kickoff without a manual refresh;
    // poll faster while a match is actually in play.
    refetchInterval: (query) => {
      const data = query.state.data as MatchView[] | undefined;
      return data?.some((m) => m.status === 'IN_PLAY' || m.status === 'PAUSED') ? 30_000 : 60_000;
    },
  });
  const predictions = useQuery({ queryKey: [...PREDS], queryFn: api.myPredictions });
  const pool = useQuery({ queryKey: ['player-pool'], queryFn: api.playerPool, staleTime: 60 * 60 * 1000 });

  const squadByTeam = useMemo(() => {
    const map = new Map<string, { id: string; name: string; position: string; team: string }[]>();
    for (const p of pool.data ?? []) {
      const k = canonTeam(p.team);
      const list = map.get(k) ?? [];
      list.push({ id: p.id, name: p.name, position: p.position, team: p.team });
      map.set(k, list);
    }
    return map;
  }, [pool.data]);

  const sectionById = useMemo(() => computeSections(matches.data ?? []), [matches.data]);

  const common = {
    onError: (_e: unknown, _v: unknown, ctx: { prev?: Prediction[] } | undefined) => {
      if (ctx?.prev) qc.setQueryData([...PREDS], ctx.prev);
      setToast('⚠️ Could not save — the match may have started');
    },
    onSuccess: () => setToast('Saved ✓'),
    onSettled: () => void qc.invalidateQueries({ queryKey: [...PREDS] }),
  };

  const save = useMutation({
    mutationFn: ({ matchId, home, away }: { matchId: string; home: number; away: number }) =>
      api.upsertPrediction(matchId, { home, away }),
    onMutate: async ({ matchId, home, away }) => {
      await qc.cancelQueries({ queryKey: [...PREDS] });
      const now = new Date().toISOString();
      const prev = patchPreds(qc, (old) => {
        const ex = old.find((p) => p.matchId === matchId);
        const next: Prediction = ex
          ? { ...ex, home, away, updatedAt: now }
          : { playerId: 'me', matchId, home, away, points: 0, joker: false, createdAt: now, updatedAt: now };
        return [...old.filter((p) => p.matchId !== matchId), next];
      });
      return { prev };
    },
    ...common,
  });

  const clear = useMutation({
    mutationFn: (matchId: string) => api.deletePrediction(matchId),
    onMutate: async (matchId) => {
      await qc.cancelQueries({ queryKey: [...PREDS] });
      const prev = patchPreds(qc, (old) => old.filter((p) => p.matchId !== matchId));
      return { prev };
    },
    ...common,
    onSuccess: () => setToast('Prediction removed'),
  });

  const joker = useMutation({
    mutationFn: ({ matchId, on }: { matchId: string; on: boolean }) => api.setJoker(matchId, on),
    onMutate: async ({ matchId, on }) => {
      await qc.cancelQueries({ queryKey: [...PREDS] });
      const section = sectionById.get(matchId);
      const now = new Date().toISOString();
      const prev = patchPreds(qc, (old) =>
        old.map((p) => {
          if (p.matchId === matchId) return { ...p, joker: on, updatedAt: now };
          if (on && p.joker && sectionById.get(p.matchId) === section) return { ...p, joker: false, updatedAt: now };
          return p;
        }),
      );
      return { prev };
    },
    ...common,
    onSuccess: () => setToast('★ Joker set'),
  });

  const firstTeam = useMutation({
    mutationFn: ({ matchId, home, away, side }: { matchId: string; home: number; away: number; side: 'HOME' | 'AWAY' | null }) =>
      api.upsertPrediction(matchId, { home, away, firstTeam: side }),
    onMutate: async ({ matchId, side }) => {
      await qc.cancelQueries({ queryKey: [...PREDS] });
      const prev = patchPreds(qc, (old) => old.map((p) => (p.matchId === matchId ? { ...p, firstTeam: side } : p)));
      return { prev };
    },
    ...common,
  });

  const firstScorer = useMutation({
    mutationFn: ({ matchId, home, away, scorerId, scorerName }: { matchId: string; home: number; away: number; scorerId: string | null; scorerName: string | null }) =>
      api.upsertPrediction(matchId, { home, away, firstScorerId: scorerId, firstScorerName: scorerName }),
    onMutate: async ({ matchId, scorerId, scorerName }) => {
      await qc.cancelQueries({ queryKey: [...PREDS] });
      const prev = patchPreds(qc, (old) =>
        old.map((p) => (p.matchId === matchId ? { ...p, firstScorerId: scorerId, firstScorerName: scorerName } : p)),
      );
      return { prev };
    },
    ...common,
  });

  const predByMatch = useMemo(() => {
    const map = new Map<string, Prediction>();
    for (const p of predictions.data ?? []) map.set(p.matchId, p);
    return map;
  }, [predictions.data]);

  const sections = useMemo(() => {
    const all = matches.data ?? [];
    const byKey = new Map<string, MatchView[]>();
    for (const m of all) {
      const k = sectionById.get(m.id) ?? 'MW1';
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
  }, [matches.data, sectionById]);

  const activeKey = useMemo(() => {
    const active = sections.find((s) => s.matches.some((m) => m.status !== 'FINISHED'));
    return active?.key ?? sections[0]?.key;
  }, [sections]);
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const isOpen = (key: string) => overrides[key] ?? key === activeKey;
  const toggle = (key: string) => setOverrides((o) => ({ ...o, [key]: !(o[key] ?? key === activeKey) }));

  if (matches.isLoading) return <p>Loading fixtures…</p>;
  if (matches.isError) return <p className="error">Could not load fixtures. Is the API running?</p>;

  const busy = save.isPending || joker.isPending || firstTeam.isPending || firstScorer.isPending || clear.isPending;

  return (
    <div className="fixtures">
      <h2>Fixtures</h2>
      <p className="muted fine">★ Tip: set a <b>Joker</b> on one match per section (match week / round) to double its points.</p>

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
              <div className={`collapse ${open ? 'open' : ''}`} aria-hidden={!open}>
                <div className="collapse-inner">
                  <div className="match-grid">
                    {s.matches.map((m) => (
                      <MatchCard
                        key={m.id}
                        match={m}
                        prediction={predByMatch.get(m.id)}
                        saving={busy}
                        squad={[...(squadByTeam.get(canonTeam(m.homeTeam)) ?? []), ...(squadByTeam.get(canonTeam(m.awayTeam)) ?? [])]}
                        onSave={(matchId, home, away) => save.mutate({ matchId, home, away })}
                        onClear={(matchId) => clear.mutate(matchId)}
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
                </div>
              </div>
            </section>
          );
        })}
      </div>

      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
