// Cross-provider team-name reconciliation (ESPN ↔ football-data) → a canonical key for matching.
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip combining diacritics
    .replace(/[^a-z]/g, '');
}

const ALIAS: Record<string, string> = {
  southkorea: 'korea', korearepublic: 'korea',
  unitedstates: 'usa', us: 'usa',
  ivorycoast: 'cotedivoire', cotedivoire: 'cotedivoire',
  drcongo: 'congodr', congodr: 'congodr', democraticrepublicofthecongo: 'congodr',
  czechrepublic: 'czechia', czechia: 'czechia',
  capeverdeislands: 'capeverde', caboverde: 'capeverde',
  turkiye: 'turkey', turkey: 'turkey',
  bosniaherzegovina: 'bosnia', bosniaandherzegovina: 'bosnia',
};

export function canonTeam(s: string): string {
  const n = normalize(s);
  return ALIAS[n] ?? n;
}
