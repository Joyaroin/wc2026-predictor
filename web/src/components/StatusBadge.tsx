import type { MatchState } from '../lib/format';

const CLASS_BY_STATE: Record<MatchState, string> = {
  Played: 'badge played',
  Live: 'badge live',
  Postponed: 'badge postponed',
  Cancelled: 'badge cancelled',
  Locked: 'badge locked',
  Open: 'badge open',
};

export function StatusBadge({ state }: { state: MatchState }) {
  return (
    <span className={CLASS_BY_STATE[state]} data-testid="status-badge">
      {state === 'Live' ? '● LIVE' : state}
    </span>
  );
}
