import { Routes, Route, Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { usePlayer } from './context/PlayerContext';
import { Nav } from './components/Nav';
import { LandingPage } from './pages/LandingPage';
import { GroupsPage } from './pages/GroupsPage';
import { GroupDetailPage } from './pages/GroupDetailPage';
import { FixturesPage } from './pages/FixturesPage';
import { MatchDetailPage } from './pages/MatchDetailPage';
import { MyBreakdownPage } from './pages/MyBreakdownPage';
import { BracketPage } from './pages/BracketPage';
import { GlobalLeaderboardPage } from './pages/GlobalLeaderboardPage';
import { SettingsPage } from './pages/SettingsPage';

function RequireAuth({ children }: { children: ReactNode }) {
  const { player } = usePlayer();
  if (!player) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  const { player } = usePlayer();
  return (
    <div className="app">
      {player && <Nav />}
      <main className="container">
        <Routes>
          <Route path="/" element={player ? <Navigate to="/fixtures" replace /> : <LandingPage />} />
          <Route path="/fixtures" element={<RequireAuth><FixturesPage /></RequireAuth>} />
          <Route path="/bracket" element={<RequireAuth><BracketPage /></RequireAuth>} />
          <Route path="/groups" element={<RequireAuth><GroupsPage /></RequireAuth>} />
          <Route path="/groups/:id" element={<RequireAuth><GroupDetailPage /></RequireAuth>} />
          <Route path="/groups/:id/matches/:mid" element={<RequireAuth><MatchDetailPage /></RequireAuth>} />
          <Route path="/me" element={<RequireAuth><MyBreakdownPage /></RequireAuth>} />
          <Route path="/global" element={<RequireAuth><GlobalLeaderboardPage /></RequireAuth>} />
          <Route path="/settings" element={<RequireAuth><SettingsPage /></RequireAuth>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
