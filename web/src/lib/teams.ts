// Canonical team name for matching our (football-data) names to ESPN squad team names.
const ALIAS: Record<string, string> = {
  southkorea: 'korea',
  korearepublic: 'korea',
  unitedstates: 'usa',
  us: 'usa',
  ivorycoast: 'cotedivoire',
  cotedivoire: 'cotedivoire',
  drcongo: 'congodr',
  congodr: 'congodr',
  czechrepublic: 'czechia',
  czechia: 'czechia',
  turkiye: 'turkey',
  turkey: 'turkey',
  bosniaherzegovina: 'bosnia',
  bosniaandherzegovina: 'bosnia',
};

const DIACRITICS = new RegExp('[\\u0300-\\u036f]', 'g');

export function canonTeam(s: string): string {
  const n = s.toLowerCase().normalize('NFD').replace(DIACRITICS, '').replace(/[^a-z]/g, '');
  return ALIAS[n] ?? n;
}
