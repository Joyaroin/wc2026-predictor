import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, type MatchView } from '../api/client';
import { Flag } from '../components/Flag';
import { matchesRefetchInterval } from '../lib/liveRefetch';

interface Row {
  code: string;
  name: string;
  p: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  pts: number;
}

/** FIFA-style ranking: points, then goal difference, then goals scored, then name (deterministic). */
function compareRows(x: Row, y: Row): number {
  return y.pts - x.pts || (y.gf - y.ga) - (x.gf - x.ga) || y.gf - x.gf || x.name.localeCompare(y.name);
}

/** Group tables computed from group-stage results — finished and in-progress (provisional). */
function computeTables(ms: MatchView[]): { group: string; rows: Row[] }[] {
  const groups = new Map<string, Map<string, Row>>();
  for (const m of ms) {
    if (m.stage !== 'GROUP_STAGE' || !m.groupName || !m.homeCode || !m.awayCode) continue;
    const g = groups.get(m.groupName) ?? new Map<string, Row>();
    groups.set(m.groupName, g);
    for (const [code, name] of [[m.homeCode, m.homeTeam], [m.awayCode, m.awayTeam]] as const) {
      if (!g.has(code)) g.set(code, { code, name, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 });
    }
    // Count any group game that has a score — finished or live — so the table moves with the games.
    if (m.homeScore != null && m.awayScore != null) {
      const h = g.get(m.homeCode)!;
      const a = g.get(m.awayCode)!;
      h.p++; a.p++;
      h.gf += m.homeScore; h.ga += m.awayScore;
      a.gf += m.awayScore; a.ga += m.homeScore;
      if (m.homeScore > m.awayScore) { h.w++; a.l++; h.pts += 3; }
      else if (m.homeScore < m.awayScore) { a.w++; h.l++; a.pts += 3; }
      else { h.d++; a.d++; h.pts++; a.pts++; }
    }
  }
  return [...groups.entries()]
    .sort((x, y) => x[0].localeCompare(y[0]))
    .map(([group, g]) => ({
      group,
      rows: [...g.values()].sort(compareRows),
    }));
}

export function StandingsPage() {
  const matches = useQuery({
    queryKey: ['matches'],
    queryFn: api.matches,
    // Keep standings (and the third-place race) moving while group games are on.
    refetchInterval: (query) => matchesRefetchInterval(query.state.data as MatchView[] | undefined),
  });
  const tables = useMemo(() => computeTables(matches.data ?? []), [matches.data]);

  // The 8 best third-placed teams (across all groups) qualify — ranked the same way as the tables.
  const qualifyingThirds = useMemo(() => {
    const thirds = tables.map((t) => t.rows[2]).filter((r): r is Row => !!r);
    return new Set([...thirds].sort(compareRows).slice(0, 8).map((r) => r.code));
  }, [tables]);

  if (matches.isLoading) return <p>Loading standings…</p>;

  return (
    <div className="standings">
      <h2>Group standings</h2>
      <p className="muted fine">Top two in each group advance to the Round of 32, joined by the eight best third-placed teams.</p>
      <p className="muted fine standings-key">
        <span className="key-swatch adv" /> Top 2 &nbsp; <span className="key-swatch third" /> Best-8 third place
      </p>
      <div className="standings-grid">
        {tables.map(({ group, rows }) => (
          <div className="card standing-card" key={group} data-testid={`standing-${group}`}>
            <h3 className="standing-title">Group {group}</h3>
            <table className="standing-table">
              <thead>
                <tr><th className="t-team">Team</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GD</th><th>Pts</th></tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr
                    key={r.code}
                    className={i < 2 ? 'adv' : i === 2 && qualifyingThirds.has(r.code) ? 'adv-third' : ''}
                  >
                    <td className="t-team"><Flag code={r.code} name={r.name} /> <span title={r.name}>{r.code}</span></td>
                    <td>{r.p}</td><td>{r.w}</td><td>{r.d}</td><td>{r.l}</td>
                    <td>{r.gf - r.ga > 0 ? `+${r.gf - r.ga}` : r.gf - r.ga}</td>
                    <td className="t-pts">{r.pts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}
