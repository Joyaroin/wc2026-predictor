import type { MatchState } from '../lib/format';

export function StatusBadge({ state }: { state: MatchState }) {
  const cls = state === 'Played' ? 'badge played' : state === 'Locked' ? 'badge locked' : 'badge open';
  return (
    <span className={cls} data-testid="status-badge">
      {state}
    </span>
  );
}
