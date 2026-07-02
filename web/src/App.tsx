import { Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense, type ReactNode } from 'react';
import { usePlayer } from './context/PlayerContext';
import { Nav } from './components/Nav';
import { BottomNav } from './components/BottomNav';
import { LandingPage } from './pages/LandingPage';
import { LiveTicker } from './components/LiveTicker';
import { OnboardingTour } from './components/OnboardingTour';
import { AdPopup } from './components/AdPopup';
import { AssistantWidget } from './components/AssistantWidget';
import { useLiveScores } from './hooks/useLiveScores';

// Route pages are code-split: the logged-out landing page ships in the initial bundle,
// everything behind auth loads on demand so first paint stays small.
const FixturesPage = lazy(() => import('./pages/FixturesPage').then((m) => ({ default: m.FixturesPage })));
const GroupsPage = lazy(() => import('./pages/GroupsPage').then((m) => ({ default: m.GroupsPage })));
const GroupDetailPage = lazy(() => import('./pages/GroupDetailPage').then((m) => ({ default: m.GroupDetailPage })));
const PlayerResultsPage = lazy(() => import('./pages/PlayerResultsPage').then((m) => ({ default: m.PlayerResultsPage })));
const MatchPredictionsPage = lazy(() => import('./pages/MatchPredictionsPage').then((m) => ({ default: m.MatchPredictionsPage })));
const MyBreakdownPage = lazy(() => import('./pages/MyBreakdownPage').then((m) => ({ default: m.MyBreakdownPage })));
const AwardsPage = lazy(() => import('./pages/AwardsPage').then((m) => ({ default: m.AwardsPage })));
const StandingsPage = lazy(() => import('./pages/StandingsPage').then((m) => ({ default: m.StandingsPage })));
const BracketPage = lazy(() => import('./pages/BracketPage').then((m) => ({ default: m.BracketPage })));
const HelpPage = lazy(() => import('./pages/HelpPage').then((m) => ({ default: m.HelpPage })));
const UpdatesPage = lazy(() => import('./pages/UpdatesPage').then((m) => ({ default: m.UpdatesPage })));
const FeedbackPage = lazy(() => import('./pages/FeedbackPage').then((m) => ({ default: m.FeedbackPage })));
const GlobalLeaderboardPage = lazy(() => import('./pages/GlobalLeaderboardPage').then((m) => ({ default: m.GlobalLeaderboardPage })));
const ChatPage = lazy(() => import('./pages/ChatPage').then((m) => ({ default: m.ChatPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })));

function RequireAuth({ children }: { children: ReactNode }) {
  const { player } = usePlayer();
  if (!player) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  const { player } = usePlayer();
  useLiveScores();
  return (
    <div className="app">
      {player && <Nav />}
      {player && <BottomNav />}
      {player && <LiveTicker />}
      {player && <OnboardingTour />}
      {player && <AdPopup />}
      {player && <AssistantWidget />}
      <main className="container">
        <Suspense fallback={<div className="route-loading" aria-busy="true" />}>
          <Routes>
            <Route path="/" element={player ? <Navigate to="/fixtures" replace /> : <LandingPage />} />
            <Route path="/fixtures" element={<RequireAuth><FixturesPage /></RequireAuth>} />
            <Route path="/awards" element={<RequireAuth><AwardsPage /></RequireAuth>} />
            <Route path="/standings" element={<RequireAuth><StandingsPage /></RequireAuth>} />
            {/* legacy paths → awards */}
            <Route path="/golden-boot" element={<Navigate to="/awards" replace />} />
            <Route path="/bracket" element={<RequireAuth><BracketPage /></RequireAuth>} />
            <Route path="/groups" element={<RequireAuth><GroupsPage /></RequireAuth>} />
            <Route path="/groups/:id" element={<RequireAuth><GroupDetailPage /></RequireAuth>} />
            <Route path="/players/:pid" element={<RequireAuth><PlayerResultsPage /></RequireAuth>} />
            <Route path="/predictions/:mid" element={<RequireAuth><MatchPredictionsPage /></RequireAuth>} />
            <Route path="/groups/:id/matches/:mid" element={<RequireAuth><MatchPredictionsPage /></RequireAuth>} />
            <Route path="/me" element={<RequireAuth><MyBreakdownPage /></RequireAuth>} />
            <Route path="/global" element={<RequireAuth><GlobalLeaderboardPage /></RequireAuth>} />
            <Route path="/chat" element={<RequireAuth><ChatPage /></RequireAuth>} />
            <Route path="/settings" element={<RequireAuth><SettingsPage /></RequireAuth>} />
            <Route path="/help" element={<RequireAuth><HelpPage /></RequireAuth>} />
            <Route path="/updates" element={<RequireAuth><UpdatesPage /></RequireAuth>} />
            <Route path="/feedback" element={<RequireAuth><FeedbackPage /></RequireAuth>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  );
}
