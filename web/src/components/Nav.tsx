import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { usePlayer } from '../context/PlayerContext';
import { api } from '../api/client';
import { hasUnseenUpdates } from '../updates';
import { useGlobalChatUnread } from '../lib/useGlobalChatUnread';
import { Avatar } from './Avatar';

export function Nav() {
  const { player, logout } = usePlayer();
  const [menuOpen, setMenuOpen] = useState(false);
  const [unseen, setUnseen] = useState(hasUnseenUpdates());

  // Chat & Standings are primary destinations (top-bar links on desktop, bottom-nav tabs on
  // mobile) — surface unread chat with a dot on the Chat link.
  const globalChat = useQuery({ queryKey: ['messages', 'global', 'global'], queryFn: api.globalMessages, refetchInterval: 20_000, staleTime: 15_000 });
  const me = useQuery({ queryKey: ['account-me'], queryFn: api.me, staleTime: 60_000 });
  const chatUnread = useGlobalChatUnread(globalChat.data, player?.playerId);
  const displayName = player?.name ?? '?';

  return (
    <nav className="nav">
      <NavLink viewTransition to="/fixtures" className="brand" data-testid="nav-brand">
        <img src="/logo.svg" alt="" className="brand-logo" width="28" height="28" />
        <span className="brand-name">WC Predictions <b>2026</b></span>
      </NavLink>

      <div className="nav-links">
        <NavLink viewTransition to="/fixtures" data-testid="nav-fixtures">Fixtures</NavLink>
        <NavLink viewTransition to="/bracket" data-testid="nav-bracket">Bracket</NavLink>
        <NavLink viewTransition to="/groups" data-testid="nav-groups">Groups</NavLink>
        <NavLink viewTransition to="/me" data-testid="nav-me">My Results</NavLink>
        <NavLink viewTransition to="/chat" data-testid="nav-chat">Chat{chatUnread && <span className="menu-dot inline" data-testid="nav-chat-unread" aria-label="unread chat messages" />}</NavLink>
      </div>

      <div className="nav-user">
        <NavLink viewTransition to="/settings" className="nav-profile" title={`Account: ${displayName}`} aria-label={`Open account for ${displayName}`}>
          <Avatar name={displayName} size={26} color={me.data?.avatarColor} />
          <span className="nav-name">{displayName}</span>
        </NavLink>
        <div className="menu">
          <button
            className="menu-btn"
            onClick={() => { setMenuOpen((o) => !o); setUnseen(hasUnseenUpdates()); }}
            aria-label="Account menu"
            aria-expanded={menuOpen}
            data-testid="nav-menu"
          >
            <span className="menu-dots" aria-hidden><span /><span /><span /></span>
            {unseen && <span className="menu-dot" aria-label="new updates" />}
          </button>
          {menuOpen && (
            <>
              <div className="menu-backdrop" onClick={() => setMenuOpen(false)} />
              <div className="menu-dropdown" onClick={() => setMenuOpen(false)} data-testid="nav-dropdown">
                <NavLink viewTransition to="/standings" data-testid="nav-standings">Standings</NavLink>
                <NavLink viewTransition to="/awards" data-testid="nav-awards">Awards</NavLink>
                <NavLink viewTransition to="/settings" data-testid="nav-settings">Account</NavLink>
                <NavLink viewTransition to="/updates" data-testid="nav-updates" onClick={() => setUnseen(false)}>✨ What's new{unseen && <span className="menu-dot inline" />}</NavLink>
                <NavLink viewTransition to="/help" data-testid="nav-help">Help & rules</NavLink>
                <NavLink viewTransition to="/feedback" data-testid="nav-feedback">Feedback</NavLink>
                <button onClick={logout} data-testid="logout-button">Log out</button>
              </div>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
