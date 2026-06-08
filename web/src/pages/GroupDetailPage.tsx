import { useParams, Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { usePlayer } from '../context/PlayerContext';
import { LeaderboardTable } from '../components/LeaderboardTable';

export function GroupDetailPage() {
  const { id = '' } = useParams();
  const { player } = usePlayer();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const group = useQuery({ queryKey: ['group', id], queryFn: () => api.getGroup(id) });
  const leaderboard = useQuery({ queryKey: ['leaderboard', id], queryFn: () => api.leaderboard(id) });

  const isCreator = group.data?.createdBy === player?.playerId;

  const afterRemoval = () => {
    void qc.invalidateQueries({ queryKey: ['groups'] });
    navigate('/groups');
  };
  const deleteGroup = useMutation({ mutationFn: () => api.deleteGroup(id), onSuccess: afterRemoval });
  const leaveGroup = useMutation({ mutationFn: () => api.leaveGroup(id), onSuccess: afterRemoval });

  return (
    <div className="group-detail">
      <p><Link to="/groups">← Groups</Link></p>
      <h2>{group.data?.name ?? 'Group'}</h2>
      {group.data && (
        <p className="muted">
          Invite code: <strong data-testid="invite-code">{group.data.inviteCode}</strong> · share it with friends
        </p>
      )}

      <h3>Leaderboard</h3>
      {leaderboard.isLoading && <p>Loading…</p>}
      {leaderboard.data && <LeaderboardTable rows={leaderboard.data} meId={player?.playerId ?? ''} />}
      {leaderboard.data?.length === 0 && <p className="muted">No scores yet.</p>}

      {group.data && (
        <div className="danger-zone">
          {isCreator ? (
            <button
              className="danger"
              data-testid="delete-group-button"
              disabled={deleteGroup.isPending}
              onClick={() => {
                if (window.confirm('Delete this group for everyone? This cannot be undone.')) deleteGroup.mutate();
              }}
            >
              Delete group
            </button>
          ) : (
            <button
              className="danger"
              data-testid="leave-group-button"
              disabled={leaveGroup.isPending}
              onClick={() => {
                if (window.confirm('Leave this group?')) leaveGroup.mutate();
              }}
            >
              Leave group
            </button>
          )}
        </div>
      )}
    </div>
  );
}
