import type { Match } from '@wc2026/shared';

export type MatchState = 'Played' | 'Live' | 'Locked' | 'Open';

export function matchState(m: {
  status: Match['status'];
  locked?: boolean;
  homeScore: number | null;
  awayScore: number | null;
}): MatchState {
  if (m.status === 'FINISHED' && m.homeScore !== null && m.awayScore !== null) return 'Played';
  if (m.status === 'IN_PLAY' || m.status === 'PAUSED') return 'Live';
  if (m.locked) return 'Locked';
  return 'Open';
}

export function isLive(status: Match['status']): boolean {
  return status === 'IN_PLAY' || status === 'PAUSED';
}

/** Board priority: live matches first (0), upcoming/predictable next (1), finished last (2). */
export function boardRank(status: Match['status']): number {
  if (status === 'IN_PLAY' || status === 'PAUSED') return 0;
  if (status === 'FINISHED') return 2;
  return 1;
}

/**
 * Orders the cards within a fixtures section so the actionable match is always on top:
 * a live match comes first, then the soonest upcoming match to predict, and finished
 * matches drop to the bottom (most recent first). When a live match ends it becomes
 * FINISHED and falls away, lifting the next match to predict to the top automatically.
 */
export function compareFixtures(
  a: { status: Match['status']; kickoff: string },
  b: { status: Match['status']; kickoff: string },
): number {
  const ra = boardRank(a.status);
  const rb = boardRank(b.status);
  if (ra !== rb) return ra - rb;
  // Finished sit at the bottom newest-first; live & upcoming run soonest-first.
  return ra === 2 ? b.kickoff.localeCompare(a.kickoff) : a.kickoff.localeCompare(b.kickoff);
}

/**
 * Display minute for a live match — provider minute when available, otherwise an
 * estimate from kickoff (assumes a 15-minute half-time break). Null when not live.
 */
export function liveMinute(
  m: { status: Match['status']; minute?: number | null; kickoff: string; startedAt?: string | null },
  now: number = Date.now(),
): string | null {
  if (m.status === 'PAUSED') return 'HT';
  if (m.status !== 'IN_PLAY') return null;
  if (typeof m.minute === 'number') return `${m.minute}′`;
  // Count from the actual kickoff (when the match went live), not the scheduled time.
  const start = m.startedAt ? Date.parse(m.startedAt) : new Date(m.kickoff).getTime();
  const elapsed = Math.floor((now - start) / 60_000);
  if (elapsed < 0) return null;
  if (elapsed <= 45) return `${Math.max(1, elapsed)}′`;
  if (elapsed <= 60) return '45+′'; // first-half stoppage / around the break
  const second = elapsed - 15;
  return second >= 90 ? '90+′' : `${second}′`;
}

export function pointsLabel(points: number, exact?: boolean): string {
  const n = points > 0 ? `+${points}` : '+0';
  return exact ? `Exact ${n}` : n;
}

/** Format a kickoff time in the given IANA timezone (defaults to the device's), showing the zone. */
export function formatKickoff(iso: string, timeZone?: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
    timeZoneName: 'short',
  });
}

export function stageLabel(stage: Match['stage'], groupName: string | null): string {
  const labels: Record<Match['stage'], string> = {
    GROUP_STAGE: groupName ? `Group ${groupName}` : 'Group Stage',
    LAST_32: 'Round of 32',
    LAST_16: 'Round of 16',
    QUARTER_FINALS: 'Quarter-final',
    SEMI_FINALS: 'Semi-final',
    THIRD_PLACE: 'Third place',
    FINAL: 'Final',
  };
  return labels[stage];
}
