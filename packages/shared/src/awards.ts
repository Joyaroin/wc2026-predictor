/** When all Awards picks (Golden Boot, Tournament Winner, Dark Horse, Player of the Tournament) lock. */
export const AWARDS_LOCK_ISO = '2026-06-13T00:00:00Z';

export function awardsLocked(now: Date): boolean {
  return now.getTime() >= Date.parse(AWARDS_LOCK_ISO);
}
