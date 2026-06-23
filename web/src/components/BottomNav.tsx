import { NavLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { usePlayer } from '../context/PlayerContext';
import { api } from '../api/client';
import { hasUnreadGlobalChat } from '../lib/chatUnread';

/** Primary destinations for the thumb zone. Mobile only (hidden ≥761px via CSS). */
const TABS = [
  { to: '/fixtures', label: 'Predict', icon: 'M4 6h16M4 12h16M4 18h10' },
  { to: '/awards', label: 'Awards', icon: 'M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0V4zM5 5H3v2a3 3 0 0 0 3 3M19 5h2v2a3 3 0 0 1-3 3' },
  { to: '/groups', label: 'Groups', icon: 'M17 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9.5 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM22 20v-2a4 4 0 0 0-3-3.87M16 3.13A4 4 0 0 1 16 11' },
  { to: '/me', label: 'Me', icon: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z' },
] as const;

export function BottomNav() {
  const { player } = usePlayer();
  const globalChat = useQuery({
    queryKey: ['messages', 'global', 'global'],
    queryFn: api.globalMessages,
    refetchInterval: 20_000,
    staleTime: 15_000,
  });
  const chatUnread = hasUnreadGlobalChat(globalChat.data, player?.playerId);

  return (
    <nav className="bottom-nav" aria-label="Primary">
      {TABS.map((t) => (
        <NavLink key={t.to} to={t.to} className="bn-tab" data-testid={`bn-${t.label.toLowerCase()}`}>
          <svg viewBox="0 0 24 24" className="bn-icon" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d={t.icon} />
          </svg>
          <span className="bn-label">{t.label}</span>
        </NavLink>
      ))}
      <NavLink to="/chat" className="bn-tab" data-testid="bn-chat">
        <span className="bn-iconwrap">
          <svg viewBox="0 0 24 24" className="bn-icon" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7a8.5 8.5 0 0 1-.9-3.8A8.38 8.38 0 0 1 12.5 3a8.38 8.38 0 0 1 8.5 8.5z" />
          </svg>
          {chatUnread && <span className="bn-dot" aria-label="unread messages" />}
        </span>
        <span className="bn-label">Chat</span>
      </NavLink>
    </nav>
  );
}
