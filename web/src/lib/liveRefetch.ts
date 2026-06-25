import type { QueryClient } from '@tanstack/react-query';
import type { MatchView } from '../api/client';

/** A match is "live" while in play or at half-time. */
export function anyMatchLive(matches: MatchView[] | undefined): boolean {
  return !!matches?.some((m) => m.status === 'IN_PLAY' || m.status === 'PAUSED');
}

/**
 * Polling cadence for the shared `['matches']` query: faster while a game is in play,
 * slower otherwise (but never off, so the page flips to LIVE at kickoff on its own).
 * Centralised here so Fixtures, the LiveTicker and Standings stay in sync.
 */
export function matchesRefetchInterval(matches: MatchView[] | undefined): number {
  return anyMatchLive(matches) ? 30_000 : 60_000;
}

/**
 * Polling cadence for data that only changes when results land (leaderboards, breakdowns,
 * who-picked-what): poll every 30s **only while a match is live**, otherwise don't poll at
 * all — return-to-app focus refetch and result-driven invalidation keep it fresh. Reads the
 * cached `['matches']` so callers don't need their own matches subscription.
 */
export function resultsRefetchInterval(qc: QueryClient): number | false {
  return anyMatchLive(qc.getQueryData<MatchView[]>(['matches'])) ? 30_000 : false;
}
