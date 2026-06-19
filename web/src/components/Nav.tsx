import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { usePlayer } from '../context/PlayerContext';
import { hasUnseenUpdates } from '../updates';

export function Nav() {
  const { player, logout } = usePlayer();
  const [menuOpen, setMenuOpen] = useState(false);
  const [unseen, setUnseen] = useState(hasUnseenUpdates());

  return (
    <nav className="nav">
      <NavLink viewTransition to="/fixtures" className="brand" data-testid="nav-brand">
        <img src="/logo.png" alt="" className="brand-logo" />
        <span className="brand-name">WC Predictions <b>2026</b></span>
      </NavLink>

      <div className="nav-links">
        <NavLink viewTransition to="/fixtures" data-testid="nav-fixtures">Fixtures</NavLink>
        <NavLink viewTransition to="/standings" data-testid="nav-standings">Standings</NavLink>
        <NavLink viewTransition to="/groups" data-testid="nav-groups">Groups</NavLink>
        <NavLink viewTransition to="/chat" data-testid="nav-chat">Chat</NavLink>
      </div>

      <div className="nav-user">
        <span className="nav-name">{player?.name}</span>
        <div className="menu">
          <button
            className="menu-btn"
            onClick={() => { setMenuOpen((o) => !o); setUnseen(hasUnseenUpdates()); }}
            aria-label="More"
            aria-expanded={menuOpen}
            data-testid="nav-menu"
          >
            ⋮{unseen && <span className="menu-dot" aria-label="new updates" />}
          </button>
          {menuOpen && (
            <>
              <div className="menu-backdrop" onClick={() => setMenuOpen(false)} />
              <div className="menu-dropdown" onClick={() => setMenuOpen(false)} data-testid="nav-dropdown">
                <NavLink viewTransition to="/awards" data-testid="nav-awards">Awards</NavLink>
                <NavLink viewTransition to="/me" data-testid="nav-me">My Results</NavLink>
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
