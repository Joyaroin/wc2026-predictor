/**
 * Week key for an instant: the Monday (UTC) of the week that contains it, as `YYYY-MM-DD`.
 * Used to group matches into "match weeks" (e.g. one Joker per week).
 */
export function weekKey(iso: string): string {
  const d = new Date(iso);
  const dayFromMonday = (d.getUTCDay() + 6) % 7; // Mon = 0 … Sun = 6
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - dayFromMonday));
  return monday.toISOString().slice(0, 10);
}
