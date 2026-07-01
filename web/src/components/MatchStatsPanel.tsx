import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, type MatchView, type MatchEvent, type TeamLineup, type LineupPlayer } from '../api/client';
import { Flag } from './Flag';
import { kitColor, readableText } from '../lib/kits';

function num(v: string): number {
  const n = parseFloat(v.replace('%', ''));
  return Number.isFinite(n) ? n : NaN;
}

function evIcon(kind: MatchEvent['kind']): string {
  return kind === 'goal' ? '⚽' : kind === 'pen' ? '🥅' : kind === 'yellow' ? '🟨' : kind === 'red' ? '🟥' : '🔄';
}

function displayName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

function pitchName(name: string): string {
  const parts = displayName(name).split(/\s+/);
  if (parts.length <= 1) return parts[0] ?? name;
  return `${parts[0]![0]}. ${parts[parts.length - 1]!}`;
}

function LineupCol({ code, name, lineup, showBench = true }: { code: string | null; name: string; lineup: TeamLineup; showBench?: boolean }) {
  return (
    <div className="lu-col">
      <div className="lu-head">
        <Flag code={code} name={name} />
        <span className="lu-team">{code ?? name}</span>
        <span className="lu-kind">Starting XI</span>
        {lineup.formation && <span className="lu-form">{lineup.formation}</span>}
      </div>
      <ol className="lu-list starters">
        {lineup.starters.map((p, i) => (
          <li key={i}>
            <span className="lu-num">{p.number ?? '–'}</span>
            <span className="lu-name" title={displayName(p.name)}>{displayName(p.name)}</span>
            {p.position && <span className="lu-pos">{p.position}</span>}
          </li>
        ))}
      </ol>
      {showBench && lineup.bench.length > 0 && (
        <>
          <div className="lu-sub">Bench</div>
          <ul className="lu-list bench">
            {lineup.bench.map((p, i) => (
              <li key={i}>
                <span className="lu-num">{p.number ?? '–'}</span>
                <span className="lu-name" title={displayName(p.name)}>{displayName(p.name)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

/** Rows of players (GK first) for `total` starters, from the formation string when it fits, else a sensible default. */
function lineCounts(formation: string | null, total: number): number[] {
  const nums = (formation ?? '').split('-').map((n) => parseInt(n, 10)).filter((n) => n > 0);
  const sum = nums.reduce((a, b) => a + b, 0);
  if (nums.length > 0 && sum === total) return nums; // formation already includes the keeper (e.g. 1-4-2-3-1)
  if (nums.length > 0 && sum + 1 === total) return [1, ...nums]; // keeper implicit (e.g. 4-2-3-1)
  if (total <= 1) return [total];
  const out = total - 1; // outfield players to spread over 3 rows
  const a = Math.round(out * 0.4);
  const b = Math.round(out * 0.33);
  return [1, a, b, out - a - b].filter((n) => n > 0);
}

/** Place the starting XI on a vertical pitch (home goal at bottom, away at top). */
function teamLayout(lineup: TeamLineup, side: 'home' | 'away'): { p: LineupPlayer; top: number; left: number }[] {
  const lines = lineCounts(lineup.formation, lineup.starters.length);
  const out: { p: LineupPlayer; top: number; left: number }[] = [];
  let idx = 0;
  for (let li = 0; li < lines.length; li++) {
    const n = lines[li]!;
    const t = lines.length > 1 ? li / (lines.length - 1) : 0;
    const top = side === 'home' ? 92 - t * 36 : 8 + t * 36;
    for (let j = 0; j < n && idx < lineup.starters.length; j++) {
      out.push({ p: lineup.starters[idx++]!, top, left: ((j + 1) / (n + 1)) * 100 });
    }
  }
  return out;
}

function Pitch({ home, away, homeCode, awayCode }: { home: TeamLineup; away: TeamLineup; homeCode: string | null; awayCode: string | null }) {
  const hKit = kitColor(homeCode);
  const aKit = kitColor(awayCode);
  const players = [
    ...teamLayout(away, 'away').map((x) => ({ ...x, side: 'away' as const, bg: aKit })),
    ...teamLayout(home, 'home').map((x) => ({ ...x, side: 'home' as const, bg: hKit })),
  ];
  return (
    <div className="pitch" data-testid="lineup-pitch">
      <div className="pitch-box top" />
      <div className="pitch-box bottom" />
      {players.map((x, i) => (
        <div className={`pitch-player ${x.side}`} key={i} style={{ top: `${x.top}%`, left: `${x.left}%` }}>
          <span className="pitch-jersey" style={{ background: x.bg, color: readableText(x.bg) }}>{x.p.number ?? '–'}</span>
          <span className="pitch-name" title={displayName(x.p.name)}>{pitchName(x.p.name)}</span>
        </div>
      ))}
    </div>
  );
}

function Bench({ code, lineup }: { code: string | null; lineup: TeamLineup }) {
  if (lineup.bench.length === 0) return null;
  return (
    <div className="lu-col">
      <div className="lu-sub">{code ?? ''} bench</div>
      <ul className="lu-list bench">
        {lineup.bench.map((p, i) => (
          <li key={i}><span className="lu-num">{p.number ?? '–'}</span><span className="lu-name" title={displayName(p.name)}>{displayName(p.name)}</span></li>
        ))}
      </ul>
    </div>
  );
}

/** Lazily-loaded full match details from ESPN: timeline, stats, where to watch, and lineups. */
export function MatchStatsPanel({ match }: { match: MatchView }) {
  const live = match.status === 'IN_PLAY' || match.status === 'PAUSED';
  const pre = !live && match.status !== 'FINISHED';
  const q = useQuery({
    queryKey: ['match-stats', match.id],
    queryFn: () => api.matchStats(match.id),
    refetchInterval: live ? 30_000 : false,
    staleTime: live ? 15_000 : pre ? 2 * 60_000 : 5 * 60_000,
  });
  const [tab, setTab] = useState<'details' | 'lineups'>(pre ? 'lineups' : 'details');

  if (q.isLoading) return <div className="ms-panel ms-state muted fine">Loading match details…</div>;
  if (q.isError) return <div className="ms-panel ms-state muted fine">Couldn't load details right now.</div>;
  const s = q.data;
  if (!s) return <div className="ms-panel ms-state muted fine">No detailed info available for this match yet.</div>;

  const hasDetails = s.stats.length > 0 || s.timeline.length > 0 || s.broadcasts.length > 0;
  const hasLineups = !!s.lineups.home || !!s.lineups.away;

  return (
    <div className="ms-panel" data-testid={`stats-panel-${match.id}`}>
      {(s.venue || s.status) && (
        <div className="ms-meta fine">
          {s.status && <span className="ms-meta-chip">{s.status}</span>}
          {s.venue && <span className="ms-meta-chip">{s.venue}</span>}
        </div>
      )}

      <div className="ms-tabs" role="tablist">
        <button type="button" className={tab === 'details' ? 'on' : ''} onClick={() => setTab('details')} data-testid={`tab-details-${match.id}`}>Timeline & stats</button>
        <button type="button" className={tab === 'lineups' ? 'on' : ''} onClick={() => setTab('lineups')} data-testid={`tab-lineups-${match.id}`}>Lineups</button>
      </div>

      {tab === 'details' && (
        !hasDetails ? (
          <div className="ms-state muted fine">No match data yet.</div>
        ) : (
          <>
            {s.timeline.length > 0 && (
              <section className="ms-section">
                <div className="ms-section-head">
                  <span>Timeline</span>
                  <span>{s.timeline.length} events</span>
                </div>
                <div className="ms-timeline">
                  {s.timeline.slice().reverse().map((e, i) => {
                    const home = e.side === 'HOME';
                    const teamCode = home ? match.homeCode : match.awayCode;
                    const teamName = home ? match.homeTeam : match.awayTeam;
                    const icon = evIcon(e.kind);
                    return (
                      <div className="ms-ev" data-side={home ? 'home' : 'away'} key={i}>
                        <span className="ms-ev-home">
                          {home && <><span className="ms-ev-text">{e.text}</span><span className="ms-ev-icon">{icon}</span><Flag code={match.homeCode} name={match.homeTeam} /></>}
                        </span>
                        <span className="ms-ev-clock">{e.clock}</span>
                        <span className="ms-ev-away">
                          {!home && <><Flag code={match.awayCode} name={match.awayTeam} /><span className="ms-ev-icon">{icon}</span><span className="ms-ev-text">{e.text}</span></>}
                        </span>
                        <span className="ms-ev-mobile">
                          <span className="ms-ev-team">
                            <Flag code={teamCode} name={teamName} />
                            <span>{teamCode ?? teamName}</span>
                          </span>
                          <span className="ms-ev-kind" aria-hidden>{icon}</span>
                          <span className="ms-ev-copy">{e.text}</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
            {s.stats.length > 0 && (
              <section className="ms-section">
                <div className="ms-section-head">
                  <span>Match stats</span>
                  <span>{match.homeCode ?? 'Home'} vs {match.awayCode ?? 'Away'}</span>
                </div>
                <div className="ms-stats">
                  {s.stats.map((row) => {
                    const h = num(row.home);
                    const a = num(row.away);
                    const total = h + a;
                    const hPct = Number.isFinite(total) && total > 0 ? (h / total) * 100 : 50;
                    const homeMore = Number.isFinite(h) && Number.isFinite(a) && h >= a;
                    return (
                      <div className="ms-stat-row" key={row.label}>
                        <div className="ms-stat-vals">
                          <span className={homeMore ? 'strong' : ''}>{row.home}</span>
                          <span className="ms-stat-label">{row.label}</span>
                          <span className={!homeMore ? 'strong' : ''}>{row.away}</span>
                        </div>
                        <div className="ms-bar">
                          <span className="ms-bar-home" style={{ width: `${hPct}%` }} />
                          <span className="ms-bar-away" style={{ width: `${100 - hPct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
            {s.broadcasts.length > 0 && (
              <div className="ms-watch fine">
                <span>Watch</span>
                <strong>{s.broadcasts.join(' · ')}</strong>
              </div>
            )}
          </>
        )
      )}

      {tab === 'lineups' && (() => {
        if (!hasLineups) return <div className="ms-state muted fine">Lineups drop ~1 hour before kick-off — check back soon.</div>;
        const h = s.lineups.home;
        const a = s.lineups.away;
        const pitchReady = !!h && !!a && h.starters.length > 0 && a.starters.length > 0;
        if (pitchReady) {
          return (
            <>
              <div className="pitch-head fine">
                <span><Flag code={match.awayCode} name={match.awayTeam} /> <strong>{match.awayCode ?? match.awayTeam}</strong>{a!.formation && <b>{a!.formation}</b>}</span>
                <span className="pitch-vs">vs</span>
                <span>{h!.formation && <b>{h!.formation}</b>}<strong>{match.homeCode ?? match.homeTeam}</strong> <Flag code={match.homeCode} name={match.homeTeam} /></span>
              </div>
              <Pitch home={h!} away={a!} homeCode={match.homeCode} awayCode={match.awayCode} />
              <div className="ms-lineups starters">
                <LineupCol code={match.homeCode} name={match.homeTeam} lineup={h!} showBench={false} />
                <LineupCol code={match.awayCode} name={match.awayTeam} lineup={a!} showBench={false} />
              </div>
              <div className="ms-lineups bench-only">
                <Bench code={match.homeCode} lineup={h!} />
                <Bench code={match.awayCode} lineup={a!} />
              </div>
            </>
          );
        }
        return (
          <div className="ms-lineups">
            {h && <LineupCol code={match.homeCode} name={match.homeTeam} lineup={h} />}
            {a && <LineupCol code={match.awayCode} name={match.awayTeam} lineup={a} />}
          </div>
        );
      })()}
    </div>
  );
}
