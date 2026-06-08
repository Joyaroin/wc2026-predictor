import type { Match } from '@wc2026/shared';

export type MatchState = 'Played' | 'Locked' | 'Open';

export function matchState(m: {
  status: Match['status'];
  locked?: boolean;
  homeScore: number | null;
  awayScore: number | null;
}): MatchState {
  if (m.status === 'FINISHED' && m.homeScore !== null && m.awayScore !== null) return 'Played';
  if (m.locked) return 'Locked';
  return 'Open';
}

export function pointsLabel(points: number): string {
  switch (points) {
    case 5:
      return 'Exact +5';
    case 3:
      return 'Goal diff +3';
    case 2:
      return 'Result +2';
    default:
      return '+0';
  }
}

export function formatKickoff(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
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
