import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type LeaderboardRow } from '../api/client';
import { usePlayer } from '../context/PlayerContext';
import { LeaderboardTable } from '../components/LeaderboardTable';
import { Avatar, AvatarStack } from '../components/Avatar';
import { ShareInvite } from '../components/ShareInvite';
import { ChatPanel } from '../components/ChatPanel';
import { medal } from '../lib/rank';

function Podium({ rows, meId }: { rows: LeaderboardRow[]; meId: string }) {
  const top = rows.slice(0, 3);
  if (top.length < 2) return null;
  // Visual order: 2nd · 1st · 3rd
  const order = [top[1], top[0], top[2]].filter(Boolean) as LeaderboardRow[];
  return (
    <div className="podium" data-testid="podium">
      {order.map((r) => (
        <div className={`podium-spot rank-${r.rank}`} key={r.playerId}>
          <span className="podium-medal">{medal(r.rank)}</span>
          <Avatar name={r.name} size={r.rank === 1 ? 58 : 46} ring color={r.avatarColor} />
          <span className={`podium-name${r.playerId === meId ? ' me' : ''}`}>{r.name}</span>
          <span className="podium-pts">{r.points}</span>
        </div>
      ))}
    </div>
  );
}

export function GroupDetailPage() {
  const { id = '' } = useParams();
  const { player } = usePlayer();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const group = useQuery({ queryKey: ['group', id], queryFn: () => api.getGroup(id) });
  const members = useQuery({ queryKey: ['members', id], queryFn: () => api.members(id) });
  const [scope, setScope] = useState<'overall' | 'week'>('overall');
  const leaderboard = useQuery({
    queryKey: ['leaderboard', id, scope],
    queryFn: () => api.leaderboard(id, scope === 'week' ? 'week' : undefined),
  });

  const [menuOpen, setMenuOpen] = useState(false);
  const [view, setView] = useState<'board' | 'chat'>('board');
  const isCreator = group.data?.createdBy === player?.playerId;

  const afterRemoval = () => {
    void qc.invalidateQueries({ queryKey: ['groups'] });
    navigate('/groups');
  };
  const deleteGroup = useMutation({ mutationFn: () => api.deleteGroup(id), onSuccess: afterRemoval });
  const leaveGroup = useMutation({ mutationFn: () => api.leaveGroup(id), onSuccess: afterRemoval });

  const rows = leaderboard.data ?? [];
  const memberNames = (members.data ?? []).map((m) => m.name);

  return (
    <div className="group-detail">
      <p><Link to="/groups">← Groups</Link></p>

      <div className="gd-hero">
        <div className="gd-hero-main">
          <h2>{group.data?.name ?? 'Group'}</h2>
          {memberNames.length > 0 && <AvatarStack names={memberNames} size={28} />}
          <span className="muted fine">{group.data?.memberCount ?? memberNames.length} members</span>
        </div>
        {group.data && (
          <div className="gd-menu">
            <button className="icon-btn" aria-label="Group options" aria-expanded={menuOpen} onClick={() => setMenuOpen((o) => !o)} data-testid="group-menu">⋮</button>
            {menuOpen && (
              <>
                <div className="menu-backdrop" onClick={() => setMenuOpen(false)} />
                <div className="menu-dropdown right" onClick={() => setMenuOpen(false)}>
                  {isCreator ? (
                    <button
                      className="danger-item"
                      data-testid="delete-group-button"
                      onClick={() => { if (window.confirm('Delete this group for everyone? This cannot be undone.')) deleteGroup.mutate(); }}
                    >Delete group</button>
                  ) : (
                    <button
                      className="danger-item"
                      data-testid="leave-group-button"
                      onClick={() => { if (window.confirm('Leave this group?')) leaveGroup.mutate(); }}
                    >Leave group</button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {group.data && <ShareInvite code={group.data.inviteCode} groupName={group.data.name} />}

      <div className="ms-tabs" role="tablist">
        <button type="button" className={view === 'board' ? 'on' : ''} onClick={() => setView('board')} data-testid="group-tab-board">Leaderboard</button>
        <button type="button" className={view === 'chat' ? 'on' : ''} onClick={() => setView('chat')} data-testid="group-tab-chat">💬 Chat</button>
      </div>

      {view === 'board' ? (
        <>
          <div className="lb-scope" role="group" aria-label="Leaderboard scope">
            <button className={scope === 'overall' ? 'on' : ''} onClick={() => setScope('overall')} data-testid="scope-overall">Overall</button>
            <button className={scope === 'week' ? 'on' : ''} onClick={() => setScope('week')} data-testid="scope-week">This matchday</button>
          </div>

          {leaderboard.isLoading && <p>Loading…</p>}
          {rows.length === 0 && !leaderboard.isLoading && <p className="muted">No scores yet.</p>}
          {rows.length > 0 && (
            <>
              <Podium rows={rows} meId={player?.playerId ?? ''} />
              <LeaderboardTable
                rows={rows}
                meId={player?.playerId ?? ''}
                onRowClick={(row) => navigate(`/players/${row.playerId}`, { state: { name: row.name, color: row.avatarColor } })}
              />
              <p className="muted fine gd-hint">Tap a player to see their picks.</p>
            </>
          )}
        </>
      ) : (
        <ChatPanel scope="group" groupId={id} />
      )}
    </div>
  );
}
