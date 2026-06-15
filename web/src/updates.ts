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
    id: '2026-06-15',
    date: 'June 15, 2026',
    emoji: '✨',
    title: 'Stat picks',
    points: [
      'Tap "✨ Stat pick" on a match to see the most likely scorelines from a statistical model',
      'One tap applies the scoreline + first team to score — fully editable after',
      'Short on time? "Fill my blanks with stat picks" predicts all your open matches at once',
      'Totally opt-in — your typed predictions are never changed unless you ask',
    ],
  },
  {
    id: '2026-06-14.5',
    date: 'June 14, 2026',
    emoji: '🧾',
    title: 'See how anyone scored',
    points: [
      'Open a player from a leaderboard and tap any of their played matches',
      'It expands into the full points receipt — result, goal difference, exact, each team\'s goals, first scorer and Joker',
    ],
  },
  {
    id: '2026-06-14.4',
    date: 'June 14, 2026',
    emoji: '👤',
    title: 'A proper Account page',
    points: [
      'New profile header with your avatar, global rank, points, exacts and groups',
      'Pick your own avatar colour — it shows across every leaderboard',
      'Cleaner sections, and changes now confirm with a quick "Saved ✓"',
      'PIN change has show/hide and a live match check; a Log out button lives here too',
    ],
  },
  {
    id: '2026-06-14.3',
    date: 'June 14, 2026',
    emoji: '👥',
    title: 'Groups, levelled up',
    points: [
      'Each group now shows your rank, points and the leader at a glance, with member avatars',
      'One-tap Share invite — send friends a code straight from the group',
      'A top-3 podium, an "Overall vs This matchday" toggle, and tap any player to see their picks',
      'The Global leaderboard now lives at the top of the Groups tab',
    ],
  },
  {
    id: '2026-06-14.2',
    date: 'June 14, 2026',
    emoji: '💾',
    title: 'No more Save button',
    points: [
      'Your pick now saves itself — type a scoreline and it\'s stored automatically',
      'First team to score, first goalscorer and your Joker also save the moment you tap them',
      'A little "Saving… / Saved ✓" shows the status; clear both boxes to remove a pick',
    ],
  },
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
