// FIFA 3-letter team code → flagcdn code (ISO 3166-1 alpha-2, or gb-eng/gb-sct subdivisions).
const FIFA_TO_CC: Record<string, string> = {
  ALG: 'dz', ARG: 'ar', AUS: 'au', AUT: 'at', BEL: 'be', BIH: 'ba', BRA: 'br', CAN: 'ca',
  CIV: 'ci', COD: 'cd', COL: 'co', CPV: 'cv', CRO: 'hr', CUW: 'cw', CZE: 'cz', ECU: 'ec',
  EGY: 'eg', ENG: 'gb-eng', ESP: 'es', FRA: 'fr', GER: 'de', GHA: 'gh', HAI: 'ht', IRN: 'ir',
  IRQ: 'iq', JOR: 'jo', JPN: 'jp', KOR: 'kr', KSA: 'sa', MAR: 'ma', MEX: 'mx', NED: 'nl',
  NOR: 'no', NZL: 'nz', PAN: 'pa', PAR: 'py', POR: 'pt', QAT: 'qa', RSA: 'za', SCO: 'gb-sct',
  SEN: 'sn', SUI: 'ch', SWE: 'se', TUN: 'tn', TUR: 'tr', URU: 'uy', USA: 'us', UZB: 'uz',
};

/** Flag image URLs for a FIFA code, or null if unknown (e.g. knockout placeholders). */
export function flagUrls(code: string | null | undefined): { src: string; srcSet: string } | null {
  if (!code) return null;
  const cc = FIFA_TO_CC[code.toUpperCase()];
  if (!cc) return null;
  return {
    src: `https://flagcdn.com/24x18/${cc}.png`,
    srcSet: `https://flagcdn.com/48x36/${cc}.png 2x`,
  };
}
