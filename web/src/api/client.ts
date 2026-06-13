import type { Match, Group, Prediction, BracketPick, BracketSide } from '@wc2026/shared';

export interface AuthResult {
  playerId: string;
  name: string;
  token: string;
  tourSeen: boolean;
}
export interface PublicPlayer {
  id: string;
  name: string;
  tourSeen?: boolean;
}
export interface GroupSummary {
  id: string;
  name: string;
  memberCount: number;
}
export interface MatchView extends Match {
  locked: boolean;
}
export interface LeaderboardRow {
  rank: number;
  playerId: string;
  name: string;
  points: number;
  exacts: number;
  correctResults: number;
}
export interface MatchPredictionRow {
  playerId: string;
  name: string;
  home: number;
  away: number;
  points: number;
}
export interface MatchPredictionsView {
  locked: boolean;
  actual: { home: number; away: number } | null;
  predictions: MatchPredictionRow[];
}
export interface GlobalLeaderboardView {
  total: number;
  top: LeaderboardRow[];
  me: LeaderboardRow | null;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

export interface FeedbackItem {
  id: string;
  playerId: string;
  playerName: string;
  message: string;
  page?: string | null;
  createdAt: string;
}

let authToken: string | null = null;
export function setAuthToken(token: string | null): void {
  authToken = token;
}

/**
 * Central 401 hook. Registered by the app (PlayerProvider) so an expired/invalid
 * session is handled in one place — without it, a stale token leaves the SPA stuck
 * on authenticated pages that keep failing silently. Invoked once per 401 response.
 */
let onUnauthorized: (() => void) | null = null;
export function setOnUnauthorized(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

async function req<T>(path: string, opts: { method?: string; body?: unknown; headers?: Record<string, string> } = {}): Promise<T> {
  const res = await fetch(`${BASE}/api${path}`, {
    method: opts.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...(opts.headers ?? {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) {
    // Expired/invalid session — let the app log the user out (redirect to landing).
    if (res.status === 401) onUnauthorized?.();
    let message = res.statusText;
    try {
      const data = (await res.json()) as { error?: string };
      if (data.error) message = data.error;
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, message);
  }
  return (await res.json()) as T;
}

export const api = {
  login: (name: string, pin: string) => req<AuthResult>('/auth/login', { method: 'POST', body: { name, pin } }),
  me: () => req<PublicPlayer>('/players/me'),
  rename: (name: string) => req<PublicPlayer>('/players/me/name', { method: 'POST', body: { name } }),
  markTourSeen: () => req<{ ok: true }>('/players/me/tour-seen', { method: 'POST' }),
  listGroups: () => req<GroupSummary[]>('/groups'),
  createGroup: (name: string) => req<Group>('/groups', { method: 'POST', body: { name } }),
  joinGroup: (inviteCode: string) => req<Group>('/groups/join', { method: 'POST', body: { inviteCode } }),
  getGroup: (id: string) => req<Group & { memberCount: number }>(`/groups/${id}`),
  deleteGroup: (id: string) => req<{ ok: true }>(`/groups/${id}`, { method: 'DELETE' }),
  leaveGroup: (id: string) => req<{ ok: true }>(`/groups/${id}/leave`, { method: 'POST' }),
  changePin: (currentPin: string, newPin: string) =>
    req<{ ok: true }>('/players/me/pin', { method: 'POST', body: { currentPin, newPin } }),
  members: (id: string) => req<PublicPlayer[]>(`/groups/${id}/members`),
  leaderboard: (id: string) => req<LeaderboardRow[]>(`/groups/${id}/leaderboard`),
  matchPredictions: (groupId: string, matchId: string) =>
    req<MatchPredictionsView>(`/groups/${groupId}/matches/${matchId}/predictions`),
  matches: () => req<MatchView[]>('/matches'),
  submitFeedback: (message: string, page?: string) =>
    req<{ ok: true }>('/feedback', { method: 'POST', body: { message, page } }),
  feedbackAdminMe: () => req<{ isAdmin: boolean }>('/feedback/admin/me'),
  feedbackAdmin: () => req<FeedbackItem[]>('/feedback/admin'),
  adminFeedback: (token: string) =>
    req<FeedbackItem[]>('/admin/feedback', { headers: { 'X-Admin-Token': token } }),
  myPredictions: () => req<Prediction[]>('/predictions/me'),
  upsertPrediction: (
    matchId: string,
    body: { home: number; away: number; firstTeam?: 'HOME' | 'AWAY' | null; firstScorerId?: string | null; firstScorerName?: string | null },
  ) => req<Prediction>(`/predictions/${matchId}`, { method: 'PUT', body }),
  setJoker: (matchId: string, joker: boolean) =>
    req<Prediction>(`/predictions/${matchId}/joker`, { method: 'PUT', body: { joker } }),
  deletePrediction: (matchId: string) =>
    req<{ ok: boolean }>(`/predictions/${matchId}`, { method: 'DELETE' }),
  globalLeaderboard: () => req<GlobalLeaderboardView>('/leaderboard/global'),
  myBracket: () => req<BracketPick[]>('/bracket/me'),
  setBracketPick: (matchId: string, side: BracketSide) =>
    req<BracketPick>(`/bracket/${matchId}`, { method: 'PUT', body: { side } }),
  playerPool: () => req<WcPlayer[]>('/players/pool'),
  goldenBoot: () => req<GoldenBootStatus>('/golden-boot'),
  setGoldenBoot: (scorerId: string, scorerName: string) =>
    req<{ scorerId: string; scorerName: string }>('/golden-boot', { method: 'PUT', body: { scorerId, scorerName } }),
  darkHorse: () => req<DarkHorseStatus>('/dark-horse'),
  setDarkHorse: (teamCode: string, teamName: string) =>
    req<{ teamCode: string; teamName: string }>('/dark-horse', { method: 'PUT', body: { teamCode, teamName } }),
  tournamentWinner: () => req<TournamentWinnerStatus>('/tournament-winner'),
  setTournamentWinner: (teamCode: string, teamName: string) =>
    req<{ teamCode: string; teamName: string }>('/tournament-winner', { method: 'PUT', body: { teamCode, teamName } }),
  playerOfTournament: () => req<PottStatus>('/player-of-tournament'),
  setPlayerOfTournament: (winnerId: string, winnerName: string) =>
    req<{ winnerId: string; winnerName: string }>('/player-of-tournament', { method: 'PUT', body: { winnerId, winnerName } }),
};

export interface PottStatus {
  pick: { winnerId: string; winnerName: string; points: number } | null;
  winner: { id: string; name: string } | null;
  locked: boolean;
}

export interface TournamentWinnerStatus {
  teams: DarkHorseTeam[];
  pick: { teamCode: string; teamName: string; points: number } | null;
  champion: { code: string; name: string } | null;
  locked: boolean;
}

export interface DarkHorseTeam {
  code: string;
  name: string;
  prob: number;
}
export interface DarkHorseStatus {
  teams: DarkHorseTeam[];
  pick: { teamCode: string; teamName: string; score: number; stage: string; placement: number; points: number } | null;
  totalPicks: number;
  locked: boolean;
}

export interface WcPlayer {
  id: string;
  name: string;
  team: string;
  position: string;
}
export interface GoldenBootStatus {
  pick: { scorerId: string; scorerName: string; points: number } | null;
  leader: { scorerId: string; scorerName: string; goals: number } | null;
  locked: boolean;
}
