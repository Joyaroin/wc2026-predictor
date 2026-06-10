import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { weekKey, type Prediction } from '@wc2026/shared';
import { api, type MatchView } from '../api/client';
import { MatchCard } from '../components/MatchCard';
import { stageLabel } from '../lib/format';
import { canonTeam } from '../lib/teams';

interface Week {
  key: string;
  label: string; // date range, e.g. "Jun 8 – 14"
  summary: string; // groups / stages in the week
  matches: MatchView[];
}

export function FixturesPage() {
  const qc = useQueryClient();
  const matches = useQuery({
    queryKey: ['matches'],
    queryFn: api.matches,
    // While any match is in play, refetch every 60s for live scores; otherwise don't poll.
    refetchInterval: (query) => {
      const data = query.state.data as MatchView[] | undefined;
      return data?.some((m) => m.status === 'IN_PLAY' || m.status === 'PAUSED') ? 60_000 : false;
    },
  });
  const predictions = useQuery({ queryKey: ['my-predictions'], queryFn: api.myPredictions });
  const pool = useQuery({ queryKey: ['player-pool'], queryFn: api.playerPool, staleTime: 60 * 60 * 1000 });

  const squadByTeam = useMemo(() => {
    const map = new Map<string, { id: string; name: string }[]>();
    for (const p of pool.data ?? []) {
      const k = canonTeam(p.team);
      const list = map.get(k) ?? [];
      list.push({ id: p.id, name: p.name });
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

  const weeks = useMemo(() => groupByWeek(matches.data ?? []), [matches.data]);

  // Default-open the "active" week (first with an unplayed match); collapse the rest.
  const activeKey = useMemo(() => {
    const active = weeks.find((w) => w.matches.some((m) => m.status !== 'FINISHED'));
    return active?.key ?? weeks[0]?.key;
  }, [weeks]);
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const isOpen = (key: string) => overrides[key] ?? key === activeKey;
  const toggle = (key: string) => setOverrides((o) => ({ ...o, [key]: !(o[key] ?? key === activeKey) }));

  if (matches.isLoading) return <p>Loading fixtures…</p>;
  if (matches.isError) return <p className="error">Could not load fixtures. Is the API running?</p>;

  return (
    <div className="fixtures">
      <h2>Fixtures</h2>
      <p className="muted fine">★ Tip: set a <b>Joker</b> on one match per match week to double its points.</p>
      {(save.isError || joker.isError) && <p className="error">Could not save — the match may have started.</p>}

      <div className="weeks">
        {weeks.map((w, i) => {
          const open = isOpen(w.key);
          return (
            <section key={w.key} className={`week ${open ? 'open' : ''}`}>
              <button className="week-header" onClick={() => toggle(w.key)} aria-expanded={open} data-testid={`week-${w.key}`}>
                <span className="week-cal" aria-hidden>📅</span>
                <span className="week-title">
                  Matchweek {i + 1}
                  <span className="muted fine"> · {w.label}</span>
                </span>
                <span className="week-sum muted fine">{w.summary} · {w.matches.length}</span>
                <span className={`chevron ${open ? 'down' : ''}`} aria-hidden>▸</span>
              </button>
              {open && (
                <div className="match-grid">
                  {w.matches.map((m) => (
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

function groupByWeek(matches: MatchView[]): Week[] {
  const byWeek = new Map<string, MatchView[]>();
  for (const m of matches) {
    const k = weekKey(m.kickoff);
    const list = byWeek.get(k) ?? [];
    list.push(m);
    byWeek.set(k, list);
  }
  return [...byWeek.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, list]) => {
      list.sort((a, b) => a.kickoff.localeCompare(b.kickoff));
      return { key, label: weekRange(key), summary: weekSummary(list), matches: list };
    });
}

function weekRange(mondayISO: string): string {
  const mon = new Date(`${mondayISO}T00:00:00Z`);
  const sun = new Date(mon);
  sun.setUTCDate(mon.getUTCDate() + 6);
  const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
  return `${fmt(mon)} – ${fmt(sun)}`;
}

function weekSummary(list: MatchView[]): string {
  const groups = [...new Set(list.filter((m) => m.stage === 'GROUP_STAGE' && m.groupName).map((m) => m.groupName as string))].sort();
  const stages = [...new Set(list.filter((m) => m.stage !== 'GROUP_STAGE').map((m) => stageLabel(m.stage, null)))];
  const parts: string[] = [];
  if (groups.length > 0) parts.push(groups.length > 2 ? `Groups ${groups[0]}–${groups[groups.length - 1]}` : `Group ${groups.join(', ')}`);
  parts.push(...stages);
  return parts.join(' · ') || 'Fixtures';
}
