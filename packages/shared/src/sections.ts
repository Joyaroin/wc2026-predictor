// Fixtures sections: 3 custom group-stage "match weeks" + one section per knockout round.
// Used for both the Fixtures dropdowns and the "one Joker per section" rule.
import type { Match, Stage } from './types';

export type SectionKey = 'MW1' | 'MW2' | 'MW3' | 'LAST_32' | 'LAST_16' | 'QUARTER_FINALS' | 'SEMI_FINALS' | 'FINAL';

export const SECTION_ORDER: SectionKey[] = ['MW1', 'MW2', 'MW3', 'LAST_32', 'LAST_16', 'QUARTER_FINALS', 'SEMI_FINALS', 'FINAL'];

const SECTION_LABEL: Record<SectionKey, string> = {
  MW1: 'Matchweek 1',
  MW2: 'Matchweek 2',
  MW3: 'Matchweek 3',
  LAST_32: 'Round of 32',
  LAST_16: 'Round of 16',
  QUARTER_FINALS: 'Quarter-finals',
  SEMI_FINALS: 'Semi-finals',
  FINAL: 'Final & 3rd place',
};

export function sectionLabel(key: string): string {
  return SECTION_LABEL[key as SectionKey] ?? key;
}

function findGroupMatch(group: Match[], a: string, b: string): Match | undefined {
  return group.find((m) => {
    const codes = [m.homeCode?.toUpperCase(), m.awayCode?.toUpperCase()];
    return codes.includes(a) && codes.includes(b);
  });
}

/**
 * Map each match to its Fixtures section.
 * Group stage is split into 3 weeks by boundary fixtures:
 *   MW1 = first match … Uzbekistan v Colombia (inclusive)
 *   MW3 = Switzerland v Canada … last group match
 *   MW2 = everything between (Czechia v South Africa … Colombia v DR Congo)
 * Knockouts get one section per round; the third-place match sits with the Final.
 */
export function computeSections(matches: Match[]): Map<string, SectionKey> {
  const out = new Map<string, SectionKey>();
  const group = matches.filter((m) => m.stage === 'GROUP_STAGE');
  const mw1End = findGroupMatch(group, 'UZB', 'COL');
  const mw3Start = findGroupMatch(group, 'SUI', 'CAN');
  const t1 = mw1End ? Date.parse(mw1End.kickoff) : undefined;
  const t3 = mw3Start ? Date.parse(mw3Start.kickoff) : undefined;

  for (const m of matches) {
    if (m.stage !== 'GROUP_STAGE') {
      const knockout: Stage = m.stage === 'THIRD_PLACE' ? 'FINAL' : m.stage;
      out.set(m.id, knockout as SectionKey);
      continue;
    }
    let mw: SectionKey = 'MW2';
    if (t1 !== undefined && t3 !== undefined) {
      const t = Date.parse(m.kickoff);
      mw = t <= t1 ? 'MW1' : t >= t3 ? 'MW3' : 'MW2';
    } else {
      mw = m.matchday === 1 ? 'MW1' : m.matchday === 3 ? 'MW3' : 'MW2'; // fallback if boundaries absent
    }
    out.set(m.id, mw);
  }
  return out;
}
