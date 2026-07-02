import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { MatchView } from '../api/client';
import { usePlayer } from '../context/PlayerContext';
import { openLiveStream, emitGoal, type LiveScoreEvent } from '../lib/liveStream';

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

// Pure: returns a banner label when this score event represents a new goal (total rose),
// else null. Extracted so it is unit-testable without React.
export function goalMessage(prev: MatchView | undefined, e: LiveScoreEvent): string | null {
  if (e.type !== 'score' || !prev) return null;
  const prevTotal = (prev.homeScore ?? 0) + (prev.awayScore ?? 0);
  const nextTotal = (e.home ?? 0) + (e.away ?? 0);
  if (nextTotal <= prevTotal) return null;
  return `⚽ GOAL — ${prev.homeCode ?? prev.homeTeam} ${e.home ?? 0}–${e.away ?? 0} ${prev.awayCode ?? prev.awayTeam}`;
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
      (e) => {
        qc.setQueryData<MatchView[]>(['matches'], (old) => {
          if (!old) return old;
          const msg = goalMessage(old.find((m) => m.id === e.matchId), e);
          if (msg) emitGoal(msg);
          return applyLiveEvent(old, e);
        });
      },
      () => { /* rely on polling; EventSource retries on its own */ },
    );
    return close;
  }, [qc, token]);
}
