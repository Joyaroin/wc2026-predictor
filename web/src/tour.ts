// First-login onboarding tour (Intercom-style spotlight) using driver.js.
// Shown once per player; completing OR skipping marks it seen so it never reappears.
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';

const SEEN_PREFIX = 'wc2026.tour.seen.';

export function hasSeenTour(playerId: string): boolean {
  try {
    return localStorage.getItem(SEEN_PREFIX + playerId) === '1';
  } catch {
    return true; // storage unavailable → don't nag
  }
}

export function markTourSeen(playerId: string): void {
  try {
    localStorage.setItem(SEEN_PREFIX + playerId, '1');
  } catch {
    /* ignore */
  }
}

/** Run the 7-step tour. `onDone` fires whether the user finishes or skips. */
export function runTour(onDone?: () => void): void {
  const d = driver({
    showProgress: true,
    progressText: '{{current}} of {{total}}',
    allowClose: true,
    overlayColor: 'rgba(4, 8, 20, 0.74)',
    popoverClass: 'wc-tour',
    nextBtnText: 'Next',
    prevBtnText: 'Back',
    doneBtnText: 'Got it!',
    steps: [
      {
        popover: {
          title: '👋 Welcome to WC Predictions 2026',
          description: 'A quick 30-second tour of how it all works. You can skip anytime with the ✕ — we won’t show this again.',
        },
      },
      {
        element: '[data-testid="nav-fixtures"]',
        popover: {
          title: '⚽ Predict matches',
          description: 'In <b>Fixtures</b>, type a scoreline and hit <b>Save</b>. After saving you can also tap a flag for the <b>first team to score</b> and pick the <b>first goalscorer</b>.',
          side: 'bottom',
          align: 'start',
        },
      },
      {
        element: '[data-testid="nav-fixtures"]',
        popover: {
          title: '🎯 Points & Joker',
          description: 'Points stack up (up to <b>20</b> a match): result, goal difference, exact score, each team’s goals, plus the first-goal bonuses. Set one <b>★ Joker</b> per match-week to double a match.',
          side: 'bottom',
          align: 'start',
        },
      },
      {
        element: '[data-testid="nav-awards"]',
        popover: {
          title: '🏆 Awards',
          description: 'Make your pre-tournament picks — <b>Golden Boot</b>, <b>Tournament Winner</b>, <b>Dark Horse</b> and <b>Player of the Tournament</b>. They lock on <b>June 13</b>.',
          side: 'bottom',
          align: 'start',
        },
      },
      {
        element: '[data-testid="nav-groups"]',
        popover: {
          title: '👥 Play with friends',
          description: 'Create a group and share the invite code, or join one — then battle it out on a private leaderboard.',
          side: 'bottom',
          align: 'start',
        },
      },
      {
        element: '[data-testid="nav-menu"]',
        popover: {
          title: '⋮ Everything else',
          description: '<b>Standings</b>, your points, the <b>global leaderboard</b>, <b>Help &amp; rules</b> and <b>Feedback</b> all live in this menu.',
          side: 'bottom',
          align: 'end',
        },
      },
      {
        popover: {
          title: '🎉 You’re all set!',
          description: 'Head to <b>Fixtures</b> and make your first prediction. You can replay this tour anytime from <b>Help &amp; rules</b>.',
        },
      },
    ],
    onDestroyed: () => {
      onDone?.();
    },
  });
  d.drive();
}
