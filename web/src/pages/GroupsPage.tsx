import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueries, useQueryClient } from '@tanstack/react-query';
import { api, ApiError, type LeaderboardRow } from '../api/client';
import { usePlayer } from '../context/PlayerContext';
import { AvatarStack } from '../components/Avatar';
import { ordinal, medal } from '../lib/rank';
import { hasUnreadGlobalChat } from '../lib/chatUnread';

export function GroupsPage() {
  const qc = useQueryClient();
  const { player } = usePlayer();
  const groups = useQuery({ queryKey: ['groups'], queryFn: api.listGroups });
  const groupList = groups.data ?? [];
  const global = useQuery({ queryKey: ['global-leaderboard'], queryFn: api.globalLeaderboard, staleTime: 30_000 });
  // Shares ChatPanel's cache key so opening the chat (which marks messages seen) clears this tick.
  const globalChat = useQuery({ queryKey: ['messages', 'global', 'global'], queryFn: api.globalMessages, refetchInterval: 15_000, staleTime: 10_000 });
  const chatUnread = hasUnreadGlobalChat(globalChat.data, player?.playerId);

  // Per-group standings → show your rank + the leader on each card.
  const boards = useQueries({
    queries: groupList.map((g) => ({
      queryKey: ['leaderboard', g.id],
      queryFn: () => api.leaderboard(g.id),
      staleTime: 30_000,
    })),
  });

  const [mode, setMode] = useState<null | 'create' | 'join'>(null);
  const [newName, setNewName] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const done = () => {
    setError(null);
    setMode(null);
    void qc.invalidateQueries({ queryKey: ['groups'] });
  };
  const createGroup = useMutation({
    mutationFn: () => api.createGroup(newName),
    onSuccess: () => { setNewName(''); done(); },
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Failed to create group'),
  });
  const joinGroup = useMutation({
    mutationFn: () => api.joinGroup(code),
    onSuccess: () => { setCode(''); done(); },
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Failed to join group'),
  });

  return (
    <div className="groups-page">
      <div className="gp-globals">
        <Link to="/global" className="group-card global-card" data-testid="global-card">
          <div className="gc-top">
            <span className="gc-name">🌍 Global leaderboard</span>
            <span className="gc-members muted fine">{global.data ? `${global.data.total} players` : '…'}</span>
          </div>
          <div className="gc-stats">
            {global.data?.me ? (
              <span className="gc-rank"><span className="gc-medal">{medal(global.data.me.rank)}</span> {ordinal(global.data.me.rank)} · <strong>{global.data.me.points}</strong> pts</span>
            ) : (
              <span className="muted fine">Everyone playing, ranked</span>
            )}
            {global.data?.top?.[0] && global.data.top[0].playerId !== player?.playerId && (
              <span className="gc-leader muted fine">👑 {global.data.top[0].name} · {global.data.top[0].points}</span>
            )}
          </div>
        </Link>

        <Link to="/chat" className="group-card global-card" data-testid="global-chat-card">
          <div className="gc-top">
            <span className="gc-name">💬 Global chat{chatUnread && <span className="menu-dot inline" data-testid="global-chat-unread" aria-label="unread messages" />}</span>
          </div>
          <div className="gc-stats">
            <span className="muted fine">{chatUnread ? 'New messages — tap to read →' : 'Talk to everyone playing →'}</span>
          </div>
        </Link>
      </div>

      <h2>Your groups</h2>

      {groups.isLoading && <p>Loading…</p>}

      {!groups.isLoading && groupList.length === 0 && (
        <div className="group-empty">
          <div className="ge-emoji" aria-hidden>🏆</div>
          <h3>No groups yet</h3>
          <p className="muted">Start a group and invite your mates — or join one with a code.</p>
        </div>
      )}

      <div className="group-cards">
        {groupList.map((g, i) => {
          const board = boards[i]?.data as LeaderboardRow[] | undefined;
          const me = board?.find((r) => r.playerId === player?.playerId);
          const leader = board?.[0];
          const names = board?.map((r) => r.name) ?? [];
          return (
            <Link to={`/groups/${g.id}`} className="group-card" key={g.id} style={{ animationDelay: `${(i + 1) * 60}ms` }} data-testid={`group-${g.id}`}>
              <div className="gc-top">
                <span className="gc-name">{g.name}</span>
                <span className="gc-members muted fine">{g.memberCount} member{g.memberCount === 1 ? '' : 's'}</span>
              </div>

              {names.length > 0 && <AvatarStack names={names} />}

              <div className="gc-stats">
                {me ? (
                  <span className="gc-rank"><span className="gc-medal">{medal(me.rank)}</span> {ordinal(me.rank)} · <strong>{me.points}</strong> pts</span>
                ) : (
                  <span className="muted fine">No points yet</span>
                )}
                {leader && leader.playerId !== player?.playerId && (
                  <span className="gc-leader muted fine">👑 {leader.name} · {leader.points}</span>
                )}
                {leader && leader.playerId === player?.playerId && (
                  <span className="gc-leader muted fine">👑 You're leading</span>
                )}
              </div>
            </Link>
          );
        })}
      </div>

      {error && <p className="error">{error}</p>}

      <div className="group-actions">
        <button onClick={() => setMode(mode === 'create' ? null : 'create')} data-testid="show-create">+ New group</button>
        <button className="ghost" onClick={() => setMode(mode === 'join' ? null : 'join')} data-testid="show-join">Join with code</button>
      </div>

      {mode === 'create' && (
        <div className="card group-form">
          <div className="row">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Group name"
              maxLength={40}
              onKeyDown={(e) => { if (e.key === 'Enter' && newName.trim()) createGroup.mutate(); }}
              data-testid="create-group-name"
            />
            <button disabled={!newName.trim() || createGroup.isPending} onClick={() => createGroup.mutate()} data-testid="create-group-button">Create</button>
          </div>
        </div>
      )}

      {mode === 'join' && (
        <div className="card group-form">
          <div className="row">
            <input
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 8))}
              placeholder="Invite code"
              onKeyDown={(e) => { if (e.key === 'Enter' && code.length === 8) joinGroup.mutate(); }}
              data-testid="join-group-code"
            />
            <button disabled={code.length !== 8 || joinGroup.isPending} onClick={() => joinGroup.mutate()} data-testid="join-group-button">Join</button>
          </div>
        </div>
      )}
    </div>
  );
}
