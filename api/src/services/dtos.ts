import type { Match, Points } from '@wc2026/shared';

export interface AuthResult {
  playerId: string;
  name: string;
  token: string;
  tourSeen: boolean; // has the onboarding tour been completed/skipped
}
export interface PublicPlayer {
  id: string;
  name: string;
  tourSeen?: boolean;
  avatarColor?: string | null;
  createdAt?: string;
}
export interface GroupSummary {
  id: string;
  name: string;
  memberCount: number;
  inviteCode: string;
}
export interface MatchView extends Match {
  locked: boolean;
}
export interface MatchPredictionRow {
  playerId: string;
  name: string;
  home: number;
  away: number;
  points: Points;
}
export interface MatchPredictionsView {
  locked: boolean;
  actual: { home: number; away: number } | null;
  predictions: MatchPredictionRow[];
}
export interface LeaderboardRow {
  rank: number;
  playerId: string;
  name: string;
  points: number;
  exacts: number;
  correctResults: number;
  avatarColor?: string | null;
}
export interface GlobalLeaderboardView {
  total: number;
  top: LeaderboardRow[];
  me: LeaderboardRow | null;
}
export interface PointsBreakdown {
  outcome: boolean;
  goalDiff: boolean;
  exact: boolean;
  home: boolean;
  away: boolean;
  firstTeam: { picked: 'HOME' | 'AWAY'; hit: boolean | null } | null;
  firstScorer: { name: string | null; hit: boolean | null } | null;
  joker: boolean;
}
export interface BreakdownRow {
  matchId: string;
  home: number | null;
  away: number | null;
  actualHome: number | null;
  actualAway: number | null;
  points: Points;
  locked: boolean;
  breakdown?: PointsBreakdown | null;
}
