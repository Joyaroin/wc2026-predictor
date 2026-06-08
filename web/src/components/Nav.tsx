import { NavLink } from 'react-router-dom';
import { usePlayer } from '../context/PlayerContext';

export function Nav() {
  const { player, logout } = usePlayer();
  return (
    <nav className="nav">
      <div className="nav-links">
        <NavLink to="/fixtures" data-testid="nav-fixtures">Fixtures</NavLink>
        <NavLink to="/groups" data-testid="nav-groups">Groups</NavLink>
        <NavLink to="/me" data-testid="nav-me">My Points</NavLink>
        <NavLink to="/settings" data-testid="nav-settings">Account</NavLink>
      </div>
      <div className="nav-user">
        <span>{player?.name}</span>
        <button onClick={logout} data-testid="logout-button">Log out</button>
      </div>
    </nav>
  );
}
