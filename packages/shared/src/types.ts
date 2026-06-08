// Domain types — single source of truth shared by `api` and `web`.
// See aidlc-docs/construction/shared/functional-design/domain-entities.md

export type Stage =
  | 'GROUP_STAGE'
  | 'LAST_32'
  | 'LAST_16'
  | 'QUARTER_FINALS'
  | 'SEMI_FINALS'
  | 'THIRD_PLACE'
  | 'FINAL';

export type MatchStatus =
  | 'SCHEDULED'
  | 'TIMED'
  | 'IN_PLAY'
  | 'PAUSED'
  | 'FINISHED';

export type Outcome = 'HOME' | 'DRAW' | 'AWAY';

/** Points awarded for a single match prediction. */
export type Points = 0 | 2 | 3 | 5;

/** A scoreline (predicted or actual). Goals are integers in [0, 30] (see schemas). */
export interface Score {
  home: number;
  away: number;
}

export interface Player {
  id: string;
  name: string;
  createdAt: string; // ISO 8601
}

export interface Group {
  id: string;
  name: string;
  inviteCode: string;
  createdBy: string; // player id
  createdAt: string;
}

export interface Membership {
  groupId: string;
  playerId: string;
  joinedAt: string;
}

export interface Match {
  id: string;
  stage: Stage;
  groupName: string | null; // 'A'..'L' for group stage, null otherwise
  matchday: number | null;
  homeTeam: string;
  homeCode: string | null;
  awayTeam: string;
  awayCode: string | null;
  kickoff: string; // ISO 8601 UTC — authoritative lock time
  status: MatchStatus;
  homeScore: number | null; // full-time goals, null until played
  awayScore: number | null;
  placeholder: boolean; // true when participants are not yet determined
}

export interface Prediction {
  playerId: string;
  matchId: string;
  home: number;
  away: number;
  points: Points;
  createdAt: string;
  updatedAt: string;
}

/** Aggregated standing used to rank a player on a group leaderboard. */
export interface StandingAgg {
  playerId: string;
  name: string;
  points: number;
  exacts: number; // count of predictions scoring 5
  correctResults: number; // count of predictions scoring >= 2
}
