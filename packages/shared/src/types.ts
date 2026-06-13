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
  | 'FINISHED'
  | 'POSTPONED'
  | 'SUSPENDED'
  | 'CANCELLED';

export type Outcome = 'HOME' | 'DRAW' | 'AWAY';

/** Points awarded for a single match scoreline prediction (additive, 0–12). */
export type Points = number;

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
  /** Current match minute from the provider while live; null when unknown or not in play. */
  minute?: number | null;
  homeScore: number | null; // full-time goals, null until played
  awayScore: number | null;
  /** Who advanced/won (knockouts) — includes penalty-shootout outcomes. Null until decided. */
  winner?: Outcome | null;
  /** First team to score (from ESPN); 'NONE' for a 0-0. Null until ingested. */
  firstGoalTeam?: BracketSide | 'NONE' | null;
  /** First goalscorer (ESPN athlete id + name). Null until ingested. */
  firstScorerId?: string | null;
  firstScorerName?: string | null;
  placeholder: boolean; // true when participants are not yet determined
}

export type BracketSide = 'HOME' | 'AWAY';

/** A player's prediction of which team advances from a knockout match. */
export interface BracketPick {
  playerId: string;
  matchId: string;
  side: BracketSide; // which side of the tie advances
  teamName: string; // snapshot of the picked team's name (for display)
  points: number; // awarded once the match is decided
  createdAt: string;
  updatedAt: string;
}

export interface Prediction {
  playerId: string;
  matchId: string;
  home: number;
  away: number;
  /** Optional: which team scores first (+2 if right). */
  firstTeam?: BracketSide | null;
  /** Optional: first goalscorer pick (ESPN athlete id) (+6 if right). */
  firstScorerId?: string | null;
  firstScorerName?: string | null;
  points: Points;
  /** Set at scoring time: the scoreline was exact (used for leaderboard tie-breaks). */
  exact?: boolean;
  /**
   * Set at scoring time: the predicted W/D/L outcome matched the actual result.
   * Distinct from `points >= 2` — a wrong-outcome prediction can still earn 2 points by
   * matching only the home- or away-goal count, so this boolean is the correct tie-break basis.
   */
  correctOutcome?: boolean;
  /** When true, this match is the player's Joker for its matchday — points count double. */
  joker?: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Aggregated standing used to rank a player on a group leaderboard. */
export interface StandingAgg {
  playerId: string;
  name: string;
  points: number;
  exacts: number; // count of predictions with an exact scoreline (persisted `exact` flag)
  correctResults: number; // count of predictions with a correct W/D/L outcome (persisted `correctOutcome` flag)
}
