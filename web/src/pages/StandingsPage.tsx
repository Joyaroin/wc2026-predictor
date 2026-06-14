import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, type MatchView } from '../api/client';
import { Flag } from '../components/Flag';

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

/** Group tables computed from FINISHED group-stage results. */
function computeTables(ms: MatchView[]): { group: string; rows: Row[] }[] {
  const groups = new Map<string, Map<string, Row>>();
  for (const m of ms) {
    if (m.stage !== 'GROUP_STAGE' || !m.groupName || !m.homeCode || !m.awayCode) continue;
    const g = groups.get(m.groupName) ?? new Map<string, Row>();
    groups.set(m.groupName, g);
    for (const [code, name] of [[m.homeCode, m.homeTeam], [m.awayCode, m.awayTeam]] as const) {
      if (!g.has(code)) g.set(code, { code, name, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 });
    }
    if (m.status === 'FINISHED' && m.homeScore != null && m.awayScore != null) {
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
      rows: [...g.values()].sort(
        (x, y) => y.pts - x.pts || (y.gf - y.ga) - (x.gf - x.ga) || y.gf - x.gf || x.name.localeCompare(y.name),
      ),
    }));
}

export function StandingsPage() {
  const matches = useQuery({ queryKey: ['matches'], queryFn: api.matches });
  const tables = useMemo(() => computeTables(matches.data ?? []), [matches.data]);

  if (matches.isLoading) return <p>Loading standings…</p>;

  return (
    <div className="standings">
      <h2>Group standings</h2>
      <p className="muted fine">Top two in each group advance to the Round of 32, joined by the eight best third-placed teams.</p>
      <div className="standings-grid">
        {tables.map(({ group, rows }, ci) => (
          <div className="card standing-card" key={group} data-testid={`standing-${group}`} style={{ animationDelay: `${ci * 70}ms` }}>
            <h3 className="standing-title">Group {group}</h3>
            <table className="standing-table">
              <thead>
                <tr><th className="t-team">Team</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GD</th><th>Pts</th></tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.code} className={i < 2 ? 'adv' : ''} style={{ animationDelay: `${ci * 70 + i * 55}ms` }}>
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
