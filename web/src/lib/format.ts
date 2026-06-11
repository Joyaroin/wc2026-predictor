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
