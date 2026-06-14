import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { PlayerResults } from '../components/PlayerResults';

/** Any player's locked (past) predictions — reachable from a group or the global leaderboard. */
export function PlayerResultsPage() {
  const { pid = '' } = useParams();
  const navigate = useNavigate();
  const state = useLocation().state as { name?: string; color?: string | null } | null;

  const breakdown = useQuery({ queryKey: ['breakdown', pid], queryFn: () => api.playerBreakdown(pid) });

  return (
    <div className="member-page">
      <p><button className="linklike" onClick={() => navigate(-1)}>← Back</button></p>
      <PlayerResults name={state?.name ?? 'Player'} color={state?.color ?? null} rows={breakdown.data ?? []} loading={breakdown.isLoading} />
    </div>
  );
}
