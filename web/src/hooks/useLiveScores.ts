import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { MatchView } from '../api/client';
import { usePlayer } from '../context/PlayerContext';
import { openLiveStream, type LiveScoreEvent } from '../lib/liveStream';

// Pure reducer: apply one SSE event to the cached matches list, immutably. Returns the
// same reference when nothing changes so React Query can skip re-renders.
export function applyLiveEvent(list: MatchView[], e: LiveScoreEvent): MatchView[] {
  let changed = false;
  const next = list.map((m) => {
    if (m.id !== e.matchId) return m;
    changed = true;
    return { ...m, homeScore: e.home, awayScore: e.away, status: e.status as MatchView['status'], minute: e.minute };
  });
  return changed ? next : list;
}

// Subscribes to the live SSE stream while a session token is present, and patches the
// shared ['matches'] cache. Driven off the reactive `usePlayer().player.token` (not a
// module-level snapshot) so the stream connects once login completes and tears down /
// reconnects on token change or logout — a plain `useEffect(..., [])` read of the token
// at mount would miss the async post-login token entirely.
// On stream error the existing adaptive polling (liveRefetch) keeps data fresh — no gap.
export function useLiveScores(): void {
  const qc = useQueryClient();
  const { player } = usePlayer();
  const token = player?.token ?? null;

  useEffect(() => {
    if (!token) return;
    const close = openLiveStream(
      token,
      (e) => qc.setQueryData<MatchView[]>(['matches'], (old) => (old ? applyLiveEvent(old, e) : old)),
      () => { /* rely on polling; EventSource retries on its own */ },
    );
    return close;
  }, [qc, token]);
}
