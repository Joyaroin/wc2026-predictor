import type { Group, Match, Prediction, BracketPick } from '@wc2026/shared';

/** Backend-only player record (adds credential + uniqueness key, never exposed to clients). */
export interface PlayerRecord {
  id: string;
  name: string;
  nameKey: string; // lower(trim(name)) — uniqueness key
  pinHash: string;
  tourSeenAt?: string | null; // when the onboarding tour was completed/skipped (null = not yet)
  createdAt: string;
  updatedAt: string;
}

export interface PlayerRepo {
  getById(id: string): Promise<PlayerRecord | null>;
  getByNameKey(nameKey: string): Promise<PlayerRecord | null>;
  /** Atomic create; returns false if the nameKey is already taken. */
  create(rec: PlayerRecord): Promise<boolean>;
  /** Rename to a new free name; returns false if the new nameKey is taken. */
  rename(id: string, name: string, nameKey: string): Promise<boolean>;
  /** Replace the stored PIN hash. */
  updatePin(id: string, pinHash: string): Promise<void>;
  /** Mark the onboarding tour as seen. */
  setTourSeen(id: string, iso: string): Promise<void>;
  /** All players (used for the global leaderboard). */
  listAll(): Promise<PlayerRecord[]>;
}

export interface GroupRepo {
  create(group: Group): Promise<void>;
  getById(id: string): Promise<Group | null>;
  getByInviteCode(code: string): Promise<Group | null>;
  delete(groupId: string): Promise<void>;
}

export interface MembershipRepo {
  add(groupId: string, playerId: string, joinedAt: string): Promise<void>;
  isMember(groupId: string, playerId: string): Promise<boolean>;
  listMembers(groupId: string): Promise<string[]>;
  listGroups(playerId: string): Promise<string[]>;
  remove(groupId: string, playerId: string): Promise<void>;
  removeAll(groupId: string): Promise<void>;
}

export interface MatchRepo {
  upsert(match: Match): Promise<void>;
  getById(id: string): Promise<Match | null>;
  listAll(): Promise<Match[]>;
}

export interface PredictionRepo {
  put(prediction: Prediction): Promise<void>;
  delete(playerId: string, matchId: string): Promise<void>;
  get(playerId: string, matchId: string): Promise<Prediction | null>;
  listByPlayer(playerId: string): Promise<Prediction[]>;
  listByMatch(matchId: string): Promise<Prediction[]>;
  /** All predictions (used for the global leaderboard). */
  scanAll(): Promise<Prediction[]>;
}

export interface BracketRepo {
  put(pick: BracketPick): Promise<void>;
  get(playerId: string, matchId: string): Promise<BracketPick | null>;
  listByPlayer(playerId: string): Promise<BracketPick[]>;
  listByMatch(matchId: string): Promise<BracketPick[]>;
  scanAll(): Promise<BracketPick[]>;
}

/** A user's pre-tournament Golden Boot (top scorer) prediction. */
export interface GoldenBootPick {
  playerId: string; // our user
  scorerId: string; // picked footballer (ESPN athlete id)
  scorerName: string;
  points: number;
  createdAt: string;
  updatedAt: string;
}

export interface GoldenBootRepo {
  put(pick: GoldenBootPick): Promise<void>;
  get(playerId: string): Promise<GoldenBootPick | null>;
  scanAll(): Promise<GoldenBootPick[]>;
}

export interface TopScorer {
  scorerId: string;
  scorerName: string;
  goals: number;
}

/** Runtime, admin-toggleable feature flags. */
export interface AppFlags {
  adsEnabled: boolean;
}
export const DEFAULT_FLAGS: AppFlags = { adsEnabled: true };

export interface StatsRepo {
  getLeader(): Promise<TopScorer | null>;
  setLeader(leader: TopScorer): Promise<void>;
  getLastEspnRun(): Promise<string | null>;
  setLastEspnRun(iso: string): Promise<void>;
  /** Admin-set Player of the Tournament winner. */
  getPottWinner(): Promise<Winner | null>;
  setPottWinner(winner: Winner): Promise<void>;
  /** Runtime feature flags (admin-toggleable). */
  getFlags(): Promise<AppFlags>;
  setFlags(patch: Partial<AppFlags>): Promise<AppFlags>;
}

/** A user's pre-tournament Dark Horse pick (a team). */
export interface DarkHorsePick {
  playerId: string;
  teamCode: string;
  teamName: string;
  points: number; // placement bonus (20/10/5), computed live
  createdAt: string;
  updatedAt: string;
}

export interface DarkHorseRepo {
  put(pick: DarkHorsePick): Promise<void>;
  get(playerId: string): Promise<DarkHorsePick | null>;
  scanAll(): Promise<DarkHorsePick[]>;
}

/** A user's pre-tournament Tournament Winner pick (the champion). */
export interface TournamentWinnerPick {
  playerId: string;
  teamCode: string;
  teamName: string;
  points: number; // +10 if their team wins the cup
  createdAt: string;
  updatedAt: string;
}

export interface TournamentWinnerRepo {
  put(pick: TournamentWinnerPick): Promise<void>;
  get(playerId: string): Promise<TournamentWinnerPick | null>;
  scanAll(): Promise<TournamentWinnerPick[]>;
}

/** A user's pre-tournament Player of the Tournament pick (a footballer). */
export interface PottPick {
  playerId: string; // our user
  winnerId: string; // picked footballer (ESPN athlete id)
  winnerName: string;
  points: number; // +25 if they win the award (admin-set)
  createdAt: string;
  updatedAt: string;
}

export interface PottRepo {
  put(pick: PottPick): Promise<void>;
  get(playerId: string): Promise<PottPick | null>;
  scanAll(): Promise<PottPick[]>;
}

export interface Winner {
  id: string;
  name: string;
}

/** A user-submitted bug report / feedback note. */
export interface FeedbackItem {
  id: string;
  playerId: string;
  playerName: string;
  message: string;
  page?: string | null; // optional context (which page/feature)
  createdAt: string;
}

export interface FeedbackRepo {
  add(item: FeedbackItem): Promise<void>;
  /** All feedback, newest first. */
  listAll(): Promise<FeedbackItem[]>;
}

export interface Repositories {
  players: PlayerRepo;
  groups: GroupRepo;
  memberships: MembershipRepo;
  matches: MatchRepo;
  predictions: PredictionRepo;
  bracket: BracketRepo;
  goldenBoot: GoldenBootRepo;
  darkHorse: DarkHorseRepo;
  tournamentWinner: TournamentWinnerRepo;
  pott: PottRepo;
  feedback: FeedbackRepo;
  stats: StatsRepo;
}
