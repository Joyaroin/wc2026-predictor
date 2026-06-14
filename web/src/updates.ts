// What's-new feed — newest first. Add an entry whenever a release is promoted to production.
export interface UpdateEntry {
  id: string; // bump to mark the feed "unread" (yyyy-mm-dd or yyyy-mm-dd.n)
  date: string;
  emoji: string;
  title: string;
  points: string[];
}

export const UPDATES: UpdateEntry[] = [
  {
    id: '2026-06-14',
    date: 'June 14, 2026',
    emoji: '🗂️',
    title: 'Your results, all in one place',
    points: [
      'New My Results tab (⋮ menu) — every finished match as a card with its full points receipt',
      'Filter your results by match week or knockout round',
      'Fixtures now stays focused on what\'s left to play — matches move to My Results the moment they finish',
    ],
  },
  {
    id: '2026-06-13',
    date: 'June 13, 2026',
    emoji: '📊',
    title: 'Match stats inside every card',
    points: [
      'Tap "Match stats" on any live or finished card to expand the full picture',
      'Box score: possession, shots & shots on target, corners, fouls, cards, offsides, saves, passing',
      'Live matches refresh their stats automatically while you watch',
    ],
  },
  {
    id: '2026-06-12.2',
    date: 'June 12, 2026',
    emoji: '🐞',
    title: 'Found a bug? Tell me',
    points: [
      'New Feedback tab in the ⋮ menu — report bugs or suggest ideas in a few taps',
      'Add an optional "where" so I know which page or match you mean',
    ],
  },
  {
    id: '2026-06-12',
    date: 'June 12, 2026',
    emoji: '🔴',
    title: 'Live points, live minutes',
    points: [
      'Match cards now show the minute while a match is in play — 37′, HT at the break',
      'Your points update live with the score: the bubble and the full receipt tick along as goals go in',
      'Leaderboards move during matches too — everything settles at the final whistle',
      'The live ticker shows the minute next to every score',
    ],
  },
  {
    id: '2026-06-11.2',
    date: 'June 11, 2026',
    emoji: '🎉',
    title: 'Matchday-one polish',
    points: [
      'Post-match points receipts — every rule ticked ✓/✗ on finished cards, with a little flair',
      'Awards get their own tab and close June 13, 2 PM (Toronto)',
      'Award points now land when the tournament ends — leaderboards stay suspenseful',
      'Clear a prediction by emptying both boxes and hitting Clear',
      'Country themes 🇧🇷🇦🇷🇫🇷 + light mode in Account, and a new logo',
    ],
  },
  {
    id: '2026-06-10',
    date: 'June 10, 2026',
    emoji: '⚽',
    title: 'Smarter scoring',
    points: [
      'Additive points (max 20): outcome, goal difference, exact score, each team\'s goals',
      'New bonuses: first team to score (+2) and first player to score (+6)',
      'One Joker per match week / knockout round — doubles that match',
      'Fixtures organized into match weeks and rounds, with flags everywhere',
      'Help & rules guide in the menu',
    ],
  },
  {
    id: '2026-06-08',
    date: 'June 8, 2026',
    emoji: '🚀',
    title: 'Kickoff',
    points: [
      'Predict every match of the 2026 World Cup',
      'Groups with invite codes, group + global leaderboards',
      'Live scores and automatic scoring',
    ],
  },
];

export const LATEST_UPDATE_ID = UPDATES[0]?.id ?? '';
const SEEN_KEY = 'wc2026.updates.seen';

export function hasUnseenUpdates(): boolean {
  return localStorage.getItem(SEEN_KEY) !== LATEST_UPDATE_ID;
}
export function markUpdatesSeen(): void {
  localStorage.setItem(SEEN_KEY, LATEST_UPDATE_ID);
}
