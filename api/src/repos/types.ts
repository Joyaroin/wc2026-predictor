import type { Group, Match, Prediction } from '@wc2026/shared';

/** Backend-only player record (adds credential + uniqueness key, never exposed to clients). */
export interface PlayerRecord {
  id: string;
  name: string;
  nameKey: string; // lower(trim(name)) — uniqueness key
  pinHash: string;
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
  get(playerId: string, matchId: string): Promise<Prediction | null>;
  listByPlayer(playerId: string): Promise<Prediction[]>;
  listByMatch(matchId: string): Promise<Prediction[]>;
  /** All predictions (used for the global leaderboard). */
  scanAll(): Promise<Prediction[]>;
}

export interface Repositories {
  players: PlayerRepo;
  groups: GroupRepo;
  memberships: MembershipRepo;
  matches: MatchRepo;
  predictions: PredictionRepo;
}
