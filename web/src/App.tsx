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
import { AwardsPage } from './pages/AwardsPage';
import { StandingsPage } from './pages/StandingsPage';
import { HelpPage } from './pages/HelpPage';
import { UpdatesPage } from './pages/UpdatesPage';
import { FeedbackPage } from './pages/FeedbackPage';
import { LiveTicker } from './components/LiveTicker';
import { OnboardingTour } from './components/OnboardingTour';
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
      {player && <LiveTicker />}
      {player && <OnboardingTour />}
      <main className="container">
        <Routes>
          <Route path="/" element={player ? <Navigate to="/fixtures" replace /> : <LandingPage />} />
          <Route path="/fixtures" element={<RequireAuth><FixturesPage /></RequireAuth>} />
          <Route path="/awards" element={<RequireAuth><AwardsPage /></RequireAuth>} />
          <Route path="/standings" element={<RequireAuth><StandingsPage /></RequireAuth>} />
          {/* legacy paths → awards */}
          <Route path="/golden-boot" element={<Navigate to="/awards" replace />} />
          <Route path="/bracket" element={<Navigate to="/awards" replace />} />
          <Route path="/groups" element={<RequireAuth><GroupsPage /></RequireAuth>} />
          <Route path="/groups/:id" element={<RequireAuth><GroupDetailPage /></RequireAuth>} />
          <Route path="/groups/:id/matches/:mid" element={<RequireAuth><MatchDetailPage /></RequireAuth>} />
          <Route path="/me" element={<RequireAuth><MyBreakdownPage /></RequireAuth>} />
          <Route path="/global" element={<RequireAuth><GlobalLeaderboardPage /></RequireAuth>} />
          <Route path="/settings" element={<RequireAuth><SettingsPage /></RequireAuth>} />
          <Route path="/help" element={<RequireAuth><HelpPage /></RequireAuth>} />
          <Route path="/updates" element={<RequireAuth><UpdatesPage /></RequireAuth>} />
          <Route path="/feedback" element={<RequireAuth><FeedbackPage /></RequireAuth>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
