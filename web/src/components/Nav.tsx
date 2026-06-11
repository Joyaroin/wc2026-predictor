import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { usePlayer } from '../context/PlayerContext';

export function Nav() {
  const { player, logout } = usePlayer();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="nav">
      <NavLink to="/fixtures" className="brand" data-testid="nav-brand">
        <img src="/logo.svg" alt="" className="brand-logo" />
        <span className="brand-name">WC Predictions <b>2026</b></span>
      </NavLink>

      <div className="nav-links">
        <NavLink to="/fixtures" data-testid="nav-fixtures">Fixtures</NavLink>
        <NavLink to="/groups" data-testid="nav-groups">Groups</NavLink>
      </div>

      <div className="nav-user">
        <span className="nav-name">{player?.name}</span>
        <div className="menu">
          <button
            className="menu-btn"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="More"
            aria-expanded={menuOpen}
            data-testid="nav-menu"
          >
            ⋮
          </button>
          {menuOpen && (
            <>
              <div className="menu-backdrop" onClick={() => setMenuOpen(false)} />
              <div className="menu-dropdown" onClick={() => setMenuOpen(false)} data-testid="nav-dropdown">
                <NavLink to="/me" data-testid="nav-me">My Points</NavLink>
                <NavLink to="/global" data-testid="nav-global">Global leaderboard</NavLink>
                <NavLink to="/awards" data-testid="nav-awards">Awards</NavLink>
                <NavLink to="/settings" data-testid="nav-settings">Account</NavLink>
                <NavLink to="/help" data-testid="nav-help">Help & rules</NavLink>
                <button onClick={logout} data-testid="logout-button">Log out</button>
              </div>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
