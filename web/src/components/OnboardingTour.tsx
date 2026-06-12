import { useEffect } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { hasSeenTour, markTourSeen, runTour } from '../tour';

/** Auto-runs the onboarding tour once, on first login. Renders nothing. */
export function OnboardingTour() {
  const { player } = usePlayer();

  useEffect(() => {
    if (!player || hasSeenTour(player.playerId)) return;
    const id = player.playerId;
    // Let the nav + page settle before spotlighting.
    const t = setTimeout(() => runTour(() => markTourSeen(id)), 700);
    return () => clearTimeout(t);
  }, [player]);

  return null;
}
