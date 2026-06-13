import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { api, type MatchView } from './client';

/** Poll faster while a match is actually in play, slower otherwise. */
export function matchesRefetchInterval(data: MatchView[] | undefined): number {
  return data?.some((m) => m.status === 'IN_PLAY' || m.status === 'PAUSED') ? 30_000 : 60_000;
}

/**
 * Shared matches query used by the fixtures page and the live ticker.
 * Always polls so the UI flips to LIVE at kickoff without a manual refresh;
 * polls faster while a match is in play. Centralised here so the queryKey and
 * the refetch cadence stay in sync across all consumers.
 */
export function useMatchesQuery(): UseQueryResult<MatchView[]> {
  return useQuery({
    queryKey: ['matches'],
    queryFn: api.matches,
    refetchInterval: (query) => matchesRefetchInterval(query.state.data as MatchView[] | undefined),
  });
}
