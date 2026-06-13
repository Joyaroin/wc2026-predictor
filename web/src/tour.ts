// First-login onboarding tour (Intercom-style spotlight) using driver.js.
// "Seen" is persisted per account on the server (see OnboardingTour); this module only runs the UI.
// On narrow screens the spotlight popover can render off-screen next to the cramped top-nav, so
// mobile uses centered (modal) steps instead — always fully on-screen and dismissible.
import { driver, type DriveStep } from 'driver.js';
import 'driver.js/dist/driver.css';

interface Pop {
  title: string;
  description: string;
  side?: 'top' | 'bottom' | 'left' | 'right';
  align?: 'start' | 'center' | 'end';
}

/** Run the 7-step tour. `onDone` fires whether the user finishes or skips. */
export function runTour(onDone?: () => void): void {
  const compact = typeof window !== 'undefined' && window.matchMedia('(max-width: 720px)').matches;
  // On mobile, drop the anchor so the popover is centered (never off-screen).
  const anchored = (element: string, popover: Pop): DriveStep => (compact ? { popover } : { element, popover });

  const steps: DriveStep[] = [
    {
      popover: {
        title: '👋 Welcome to WC Predictions 2026',
        description: 'A quick 30-second tour of how it all works. You can skip anytime with the ✕ — we won’t show this again.',
      },
    },
    anchored('[data-testid="nav-fixtures"]', {
      title: '⚽ Predict matches',
      description: 'In <b>Fixtures</b>, type a scoreline and hit <b>Save</b>. After saving you can also tap a flag for the <b>first team to score</b> and pick the <b>first goalscorer</b>.',
      side: 'bottom',
      align: 'start',
    }),
    anchored('[data-testid="nav-fixtures"]', {
      title: '🎯 Points & Joker',
      description: 'Points stack up (up to <b>20</b> a match): result, goal difference, exact score, each team’s goals, plus the first-goal bonuses. Set one <b>★ Joker</b> per match-week to double a match.',
      side: 'bottom',
      align: 'start',
    }),
    anchored('[data-testid="nav-awards"]', {
      title: '🏆 Awards',
      description: 'Make your pre-tournament picks — <b>Golden Boot</b>, <b>Tournament Winner</b>, <b>Dark Horse</b> and <b>Player of the Tournament</b>. They lock on <b>June 13</b>.',
      side: 'bottom',
      align: 'start',
    }),
    anchored('[data-testid="nav-groups"]', {
      title: '👥 Play with friends',
      description: 'Create a group and share the invite code, or join one — then battle it out on a private leaderboard.',
      side: 'bottom',
      align: 'start',
    }),
    anchored('[data-testid="nav-menu"]', {
      title: '⋮ Everything else',
      description: '<b>Standings</b>, your points, the <b>global leaderboard</b>, <b>Help &amp; rules</b> and <b>Feedback</b> all live in this menu.',
      side: 'bottom',
      align: 'end',
    }),
    {
      popover: {
        title: '🎉 You’re all set!',
        description: 'Head to <b>Fixtures</b> and make your first prediction. You can replay this tour anytime from <b>Help &amp; rules</b>.',
      },
    },
  ];

  const d = driver({
    showProgress: true,
    progressText: '{{current}} of {{total}}',
    allowClose: true,
    smoothScroll: true,
    stagePadding: 6,
    overlayColor: 'rgba(4, 8, 20, 0.74)',
    popoverClass: 'wc-tour',
    nextBtnText: 'Next',
    prevBtnText: 'Back',
    doneBtnText: 'Got it!',
    steps,
    onDestroyed: () => {
      onDone?.();
    },
  });
  d.drive();
}
