import type { Match } from './types';

/** When all Awards picks (Golden Boot, Tournament Winner, Dark Horse, Player of the Tournament) lock. */
export const AWARDS_LOCK_ISO = '2026-06-13T00:00:00Z';

export function awardsLocked(now: Date): boolean {
  return now.getTime() >= Date.parse(AWARDS_LOCK_ISO);
}

/** Award points only pay out once the tournament is over (the final has a decided winner). */
export function tournamentFinished(matches: Match[]): boolean {
  const final = matches.find((m) => m.stage === 'FINAL');
  return !!final && (final.winner === 'HOME' || final.winner === 'AWAY');
}
