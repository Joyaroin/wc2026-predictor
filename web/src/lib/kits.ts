// Primary kit / country colour per FIFA code, for the lineup pitch jerseys.
const KIT: Record<string, string> = {
  ALG: '#1b8a4f', ARG: '#6cace4', AUS: '#ffcd00', AUT: '#ed2939', BEL: '#e30613', BIH: '#002395',
  BRA: '#ffdf00', CAN: '#ff0000', CIV: '#ff8200', COD: '#1b7ad4', COL: '#fcd116', CPV: '#1b4ea0',
  CRO: '#e1000f', CUW: '#002b7f', CZE: '#d7141a', ECU: '#ffdd00', EGY: '#c8102e', ENG: '#ffffff',
  ESP: '#c60b1e', FRA: '#002395', GER: '#ffffff', GHA: '#ffffff', HAI: '#00209f', IRN: '#ffffff',
  IRQ: '#ffffff', JOR: '#ce1126', JPN: '#002d74', KOR: '#c8102e', KSA: '#006c35', MAR: '#c1272d',
  MEX: '#006847', NED: '#ff6200', NOR: '#ba0c2f', NZL: '#ffffff', PAN: '#d21034', PAR: '#d52b1e',
  POR: '#c8102e', QAT: '#8a1538', RSA: '#007749', SCO: '#0a3161', SEN: '#00853f', SUI: '#d52b1e',
  SWE: '#ffcd00', TUN: '#e70013', TUR: '#e30a17', URU: '#5cb8e4', USA: '#ffffff', UZB: '#0099b5',
};

/** Country/kit colour for a FIFA code, or a neutral light grey when unknown. */
export function kitColor(code: string | null | undefined): string {
  return (code && KIT[code.toUpperCase()]) || '#e7e7ea';
}

/** Black or white text, whichever reads better on the given background. */
export function readableText(hex: string): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? '#111' : '#fff';
}
