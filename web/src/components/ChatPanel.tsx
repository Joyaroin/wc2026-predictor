import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiError, type ChatMessage } from '../api/client';
import { usePlayer } from '../context/PlayerContext';
import { Avatar } from './Avatar';
import { markGlobalChatSeen } from '../lib/chatUnread';

function timeLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** A polling chat feed — global (no groupId) or a single group. Refetches every 4s while mounted. */
export function ChatPanel({ scope, groupId }: { scope: 'global' | 'group'; groupId?: string }) {
  const { player } = usePlayer();
  const qc = useQueryClient();
  const key = ['messages', scope, groupId ?? 'global'];
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const admin = useQuery({ queryKey: ['admin-me'], queryFn: api.feedbackAdminMe, staleTime: 10 * 60_000 });
  const msgs = useQuery({
    queryKey: key,
    queryFn: () => (scope === 'global' ? api.globalMessages() : api.groupMessages(groupId!)),
    refetchInterval: 4000,
  });

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [msgs.data]);

  // While the global chat is open, the newest message counts as seen — clears the unread tick.
  useEffect(() => {
    if (scope === 'global' && msgs.data && msgs.data.length > 0) {
      const changed = markGlobalChatSeen(msgs.data[msgs.data.length - 1]!.id);
      // Nudge other subscribers (nav + groups card) to drop their tick right away.
      if (changed) void qc.invalidateQueries({ queryKey: key });
    }
  }, [scope, msgs.data]);

  const send = useMutation({
    mutationFn: (text: string) => (scope === 'global' ? api.postGlobalMessage(text) : api.postGroupMessage(groupId!, text)),
    onSuccess: (m) => {
      qc.setQueryData<ChatMessage[]>(key, (prev) => [...(prev ?? []), m]);
      setInput('');
      setError(null);
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Could not send — try again.'),
  });
  const del = useMutation({
    mutationFn: (id: string) => api.deleteMessage(id, scope, groupId),
    onSuccess: (_r, id) => qc.setQueryData<ChatMessage[]>(key, (prev) => (prev ?? []).filter((m) => m.id !== id)),
  });

  const list = msgs.data ?? [];

  return (
    <div className="chat">
      <div className="chat-body" ref={scrollRef}>
        {msgs.isLoading && <div className="muted fine chat-empty">Loading…</div>}
        {!msgs.isLoading && list.length === 0 && <div className="muted fine chat-empty">No messages yet — say hi 👋</div>}
        {list.map((m) => {
          const mine = m.playerId === player?.playerId;
          return (
            <div className={`chat-row ${mine ? 'mine' : ''}`} key={m.id}>
              {!mine && <Avatar name={m.playerName} size={28} color={m.avatarColor ?? undefined} />}
              <div className="chat-bubble">
                {!mine && <span className="chat-name">{m.playerName}</span>}
                <span className="chat-text">{m.text}</span>
                <span className="chat-time">{timeLabel(m.createdAt)}</span>
              </div>
              {admin.data?.isAdmin && (
                <button className="chat-del" onClick={() => del.mutate(m.id)} aria-label="Delete message" title="Delete (admin)">✕</button>
              )}
            </div>
          );
        })}
      </div>
      {error && <div className="chat-err fine">{error}</div>}
      <form
        className="chat-input"
        onSubmit={(e) => {
          e.preventDefault();
          const t = input.trim();
          if (t && !send.isPending) send.mutate(t);
        }}
      >
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Message…" maxLength={500} aria-label="Message" />
        <button type="submit" disabled={send.isPending || !input.trim()}>Send</button>
      </form>
    </div>
  );
}
