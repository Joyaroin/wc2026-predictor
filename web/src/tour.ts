// Onboarding tour content. Rendered by a custom React modal (see OnboardingTour) so taps work
// everywhere (iOS Safari included). "Seen" is persisted per account on the server.
export interface TourStep {
  title: string;
  body: string; // may contain simple <b> markup
}

export const TOUR_STEPS: TourStep[] = [
  {
    title: '👋 Welcome to WC Predictions 2026',
    body: "A quick tour of how it all works — about 30 seconds. You can skip anytime; we won't show it again.",
  },
  {
    title: '⚽ Predict matches',
    body: 'In <b>Fixtures</b>, type a scoreline and hit <b>Save</b>. After saving you can also tap a flag for the <b>first team to score</b> and pick the <b>first goalscorer</b>.',
  },
  {
    title: '🎯 Points & Joker',
    body: "Points stack up — up to <b>20</b> a match (result, goal difference, exact score, each team's goals, plus the first-goal bonuses). Set one <b>★ Joker</b> per match-week to double a match.",
  },
  {
    title: '🏆 Awards',
    body: 'Make your pre-tournament picks — <b>Golden Boot</b>, <b>Tournament Winner</b>, <b>Dark Horse</b> and <b>Player of the Tournament</b>.',
  },
  {
    title: '👥 Play with friends',
    body: 'Create a group and share the invite code, or join one in <b>Groups</b> — then battle it out on a private leaderboard.',
  },
  {
    title: '⋮ Find everything else',
    body: 'The menu (top-right) has <b>Standings</b>, your points, the <b>global leaderboard</b>, <b>Help &amp; rules</b> and <b>Feedback</b>.',
  },
  {
    title: "🎉 You're all set!",
    body: 'Head to <b>Fixtures</b> and make your first prediction. You can replay this tour anytime from <b>Help &amp; rules</b>.',
  },
];

/** Replay the tour from anywhere (e.g. Help) by signalling the always-mounted OnboardingTour. */
export const TOUR_START_EVENT = 'wc:start-tour';
export function replayTour(): void {
  window.dispatchEvent(new Event(TOUR_START_EVENT));
}
