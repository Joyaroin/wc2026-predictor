import type { Match } from '@wc2026/shared';

export type MatchState = 'Played' | 'Live' | 'Postponed' | 'Cancelled' | 'Locked' | 'Open';

export function matchState(m: {
  status: Match['status'];
  locked?: boolean;
  homeScore: number | null;
  awayScore: number | null;
}): MatchState {
  if (m.status === 'FINISHED' && m.homeScore !== null && m.awayScore !== null) return 'Played';
  if (m.status === 'IN_PLAY' || m.status === 'PAUSED') return 'Live';
  // Off-schedule statuses must not look like a normal upcoming fixture.
  // SUSPENDED (interrupted, expected to resume) reads as 'Postponed' to players;
  // CANCELLED (won't be played) reads as 'Cancelled'.
  if (m.status === 'POSTPONED' || m.status === 'SUSPENDED') return 'Postponed';
  if (m.status === 'CANCELLED') return 'Cancelled';
  if (m.locked) return 'Locked';
  return 'Open';
}

export function isLive(status: Match['status']): boolean {
  return status === 'IN_PLAY' || status === 'PAUSED';
}

/**
 * Display minute for a live match — provider minute when available, otherwise an
 * estimate from kickoff (assumes a 15-minute half-time break). Null when not live.
 */
export function liveMinute(
  m: { status: Match['status']; minute?: number | null; kickoff: string },
  now: number = Date.now(),
): string | null {
  if (m.status === 'PAUSED') return 'HT';
  if (m.status !== 'IN_PLAY') return null;
  if (typeof m.minute === 'number') return `${m.minute}′`;
  const elapsed = Math.floor((now - new Date(m.kickoff).getTime()) / 60_000);
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
