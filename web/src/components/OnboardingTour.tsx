import { useEffect } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { api } from '../api/client';
import { runTour } from '../tour';

/** Auto-runs the onboarding tour once per account, on first login. Renders nothing. */
export function OnboardingTour() {
  const { player, setTourSeen } = usePlayer();

  useEffect(() => {
    if (!player || player.tourSeen) return;
    // Let the nav + page settle before spotlighting.
    const id = window.setTimeout(() => {
      runTour(() => {
        setTourSeen(); // update this session immediately so it won't re-trigger
        api.markTourSeen().catch(() => {}); // persist per-account (all devices)
      });
    }, 700);
    return () => window.clearTimeout(id);
  }, [player, setTourSeen]);

  return null;
}
