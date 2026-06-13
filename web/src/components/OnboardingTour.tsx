import { useEffect, useState } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { api } from '../api/client';
import { TOUR_STEPS, TOUR_START_EVENT } from '../tour';

/**
 * First-login onboarding tour — a custom centered modal (works on iOS Safari, where driver.js's
 * delegated tap handling got stuck). Shows once per account; completing or skipping persists it.
 */
export function OnboardingTour() {
  const { player, setTourSeen } = usePlayer();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  // Auto-run on first login (per account).
  useEffect(() => {
    if (!player || player.tourSeen) return;
    const t = setTimeout(() => {
      setStep(0);
      setOpen(true);
    }, 600);
    return () => clearTimeout(t);
  }, [player]);

  // Replay trigger (Help & rules).
  useEffect(() => {
    const onStart = () => {
      setStep(0);
      setOpen(true);
    };
    window.addEventListener(TOUR_START_EVENT, onStart);
    return () => window.removeEventListener(TOUR_START_EVENT, onStart);
  }, []);

  // Esc closes.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish();
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') setStep((s) => Math.max(0, s - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, step]);

  const finish = () => {
    setOpen(false);
    setTourSeen(); // update session immediately
    api.markTourSeen().catch(() => {}); // persist per account, all devices
  };
  const next = () => setStep((s) => (s >= TOUR_STEPS.length - 1 ? s : s + 1));

  if (!open) return null;
  const s = TOUR_STEPS[step]!;
  const last = step === TOUR_STEPS.length - 1;

  return (
    <div className="tour-backdrop" role="dialog" aria-modal="true" aria-label="Welcome tour" data-testid="tour">
      <div className="tour-card">
        <button className="tour-skip" onClick={finish} aria-label="Skip tour" data-testid="tour-skip">✕</button>
        <div className="tour-step">{step + 1} of {TOUR_STEPS.length}</div>
        <h3 className="tour-title" dangerouslySetInnerHTML={{ __html: s.title }} />
        <p className="tour-body" dangerouslySetInnerHTML={{ __html: s.body }} />
        <div className="tour-dots" aria-hidden>
          {TOUR_STEPS.map((_, i) => <span key={i} className={i === step ? 'dot on' : 'dot'} />)}
        </div>
        <div className="tour-actions">
          <button className="tour-link" onClick={finish} data-testid="tour-skip-link">Skip</button>
          <div className="tour-nav">
            {step > 0 && <button className="tour-btn ghost" onClick={() => setStep((x) => x - 1)}>Back</button>}
            <button className="tour-btn" onClick={() => (last ? finish() : next())} data-testid="tour-next">
              {last ? 'Got it!' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
