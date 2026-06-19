// In-memory repositories — used by automated tests and the optional PERSISTENCE=memory mode.
import type { Group, Match, Prediction, BracketPick } from '@wc2026/shared';
import type {
  Repositories,
  PlayerRepo,
  PlayerRecord,
  GroupRepo,
  MembershipRepo,
  MatchRepo,
  PredictionRepo,
  BracketRepo,
  GoldenBootRepo,
  GoldenBootPick,
  DarkHorseRepo,
  DarkHorsePick,
  TournamentWinnerRepo,
  TournamentWinnerPick,
  PottRepo,
  PottPick,
  FeedbackRepo,
  FeedbackItem,
  MessageRepo,
  ChatMessage,
  StatsRepo,
  TopScorer,
  Winner,
  AppFlags,
  PushRepo,
  PushSubRecord,
  ReminderRepo,
} from './types';
import { DEFAULT_FLAGS } from './types';

export function createMemoryRepositories(): Repositories {
  const players = new Map<string, PlayerRecord>();
  const nameIndex = new Map<string, string>(); // nameKey -> playerId
  const groups = new Map<string, Group>();
  const codeIndex = new Map<string, string>(); // inviteCode -> groupId
  const members = new Map<string, Set<string>>(); // groupId -> playerIds
  const matches = new Map<string, Match>();
  const predictions = new Map<string, Prediction>(); // `${playerId}|${matchId}`
  const bracketPicks = new Map<string, BracketPick>(); // `${playerId}|${matchId}`

  const predKey = (playerId: string, matchId: string): string => `${playerId}|${matchId}`;

  const playerRepo: PlayerRepo = {
    async getById(id) {
      return players.get(id) ?? null;
    },
    async getByNameKey(nameKey) {
      const id = nameIndex.get(nameKey);
      return id ? (players.get(id) ?? null) : null;
    },
    async create(rec) {
      if (nameIndex.has(rec.nameKey)) return false;
      players.set(rec.id, rec);
      nameIndex.set(rec.nameKey, rec.id);
      return true;
    },
    async rename(id, name, nameKey) {
      const existing = players.get(id);
      if (!existing) return false;
      const owner = nameIndex.get(nameKey);
      if (owner && owner !== id) return false;
      nameIndex.delete(existing.nameKey);
      const updated: PlayerRecord = { ...existing, name, nameKey, updatedAt: new Date().toISOString() };
      players.set(id, updated);
      nameIndex.set(nameKey, id);
      return true;
    },
    async updatePin(id, pinHash) {
      const existing = players.get(id);
      if (!existing) return;
      players.set(id, { ...existing, pinHash, updatedAt: new Date().toISOString() });
    },
    async setTourSeen(id, iso) {
      const existing = players.get(id);
      if (!existing) return;
      players.set(id, { ...existing, tourSeenAt: iso });
    },
    async setAvatarColor(id, color) {
      const existing = players.get(id);
      if (!existing) return;
      players.set(id, { ...existing, avatarColor: color });
    },
    async listAll() {
      return [...players.values()];
    },
  };

  const groupRepo: GroupRepo = {
    async create(group) {
      groups.set(group.id, group);
      codeIndex.set(group.inviteCode, group.id);
    },
    async getById(id) {
      return groups.get(id) ?? null;
    },
    async getByInviteCode(code) {
      const id = codeIndex.get(code);
      return id ? (groups.get(id) ?? null) : null;
    },
    async delete(groupId) {
      const group = groups.get(groupId);
      if (group) codeIndex.delete(group.inviteCode);
      groups.delete(groupId);
    },
  };

  const membershipRepo: MembershipRepo = {
    async add(groupId, playerId) {
      const set = members.get(groupId) ?? new Set<string>();
      set.add(playerId);
      members.set(groupId, set);
    },
    async isMember(groupId, playerId) {
      return members.get(groupId)?.has(playerId) ?? false;
    },
    async listMembers(groupId) {
      return [...(members.get(groupId) ?? [])];
    },
    async listGroups(playerId) {
      const result: string[] = [];
      for (const [groupId, set] of members) {
        if (set.has(playerId)) result.push(groupId);
      }
      return result;
    },
    async remove(groupId, playerId) {
      members.get(groupId)?.delete(playerId);
    },
    async removeAll(groupId) {
      members.delete(groupId);
    },
  };

  const matchRepo: MatchRepo = {
    async upsert(match) {
      matches.set(match.id, match);
    },
    async getById(id) {
      return matches.get(id) ?? null;
    },
    async listAll() {
      return [...matches.values()].sort((a, b) => a.kickoff.localeCompare(b.kickoff));
    },
  };

  const predictionRepo: PredictionRepo = {
    async put(prediction) {
      predictions.set(predKey(prediction.playerId, prediction.matchId), prediction);
    },
    async delete(playerId, matchId) {
      predictions.delete(predKey(playerId, matchId));
    },
    async get(playerId, matchId) {
      return predictions.get(predKey(playerId, matchId)) ?? null;
    },
    async listByPlayer(playerId) {
      return [...predictions.values()].filter((p) => p.playerId === playerId);
    },
    async listByMatch(matchId) {
      return [...predictions.values()].filter((p) => p.matchId === matchId);
    },
    async scanAll() {
      return [...predictions.values()];
    },
  };

  const bracketRepo: BracketRepo = {
    async put(pick) {
      bracketPicks.set(predKey(pick.playerId, pick.matchId), pick);
    },
    async get(playerId, matchId) {
      return bracketPicks.get(predKey(playerId, matchId)) ?? null;
    },
    async listByPlayer(playerId) {
      return [...bracketPicks.values()].filter((b) => b.playerId === playerId);
    },
    async listByMatch(matchId) {
      return [...bracketPicks.values()].filter((b) => b.matchId === matchId);
    },
    async scanAll() {
      return [...bracketPicks.values()];
    },
  };

  const goldenBootPicks = new Map<string, GoldenBootPick>(); // playerId -> pick
  const goldenBootRepo: GoldenBootRepo = {
    async put(pick) {
      goldenBootPicks.set(pick.playerId, pick);
    },
    async get(playerId) {
      return goldenBootPicks.get(playerId) ?? null;
    },
    async scanAll() {
      return [...goldenBootPicks.values()];
    },
  };

  const darkHorsePicks = new Map<string, DarkHorsePick>(); // playerId -> pick
  const darkHorseRepo: DarkHorseRepo = {
    async put(pick) {
      darkHorsePicks.set(pick.playerId, pick);
    },
    async get(playerId) {
      return darkHorsePicks.get(playerId) ?? null;
    },
    async scanAll() {
      return [...darkHorsePicks.values()];
    },
  };

  const twPicks = new Map<string, TournamentWinnerPick>();
  const tournamentWinnerRepo: TournamentWinnerRepo = {
    async put(pick) {
      twPicks.set(pick.playerId, pick);
    },
    async get(playerId) {
      return twPicks.get(playerId) ?? null;
    },
    async scanAll() {
      return [...twPicks.values()];
    },
  };

  const pottPicks = new Map<string, PottPick>();
  const pottRepo: PottRepo = {
    async put(pick) {
      pottPicks.set(pick.playerId, pick);
    },
    async get(playerId) {
      return pottPicks.get(playerId) ?? null;
    },
    async scanAll() {
      return [...pottPicks.values()];
    },
  };

  const feedbackItems: FeedbackItem[] = [];
  const feedbackRepo: FeedbackRepo = {
    async add(item) {
      feedbackItems.push(item);
    },
    async listAll() {
      return [...feedbackItems].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
  };

  let leader: TopScorer | null = null;
  let lastEspnRun: string | null = null;
  let pottWinner: Winner | null = null;
  let flags: AppFlags = { ...DEFAULT_FLAGS };
  const statsRepo: StatsRepo = {
    async getLeader() {
      return leader;
    },
    async setLeader(l) {
      leader = l;
    },
    async getLastEspnRun() {
      return lastEspnRun;
    },
    async setLastEspnRun(iso) {
      lastEspnRun = iso;
    },
    async getPottWinner() {
      return pottWinner;
    },
    async setPottWinner(w) {
      pottWinner = w;
    },
    async getFlags() {
      return { ...flags };
    },
    async setFlags(patch) {
      flags = { ...flags, ...patch };
      return { ...flags };
    },
  };

  const pushSubs: PushSubRecord[] = [];
  const pushRepo: PushRepo = {
    async save(sub) {
      const i = pushSubs.findIndex((s) => s.playerId === sub.playerId && s.endpoint === sub.endpoint);
      if (i >= 0) pushSubs[i] = sub;
      else pushSubs.push(sub);
    },
    async listByPlayer(playerId) {
      return pushSubs.filter((s) => s.playerId === playerId);
    },
    async remove(playerId, endpoint) {
      const i = pushSubs.findIndex((s) => s.playerId === playerId && s.endpoint === endpoint);
      if (i >= 0) pushSubs.splice(i, 1);
    },
    async listSubscribers() {
      return [...new Set(pushSubs.map((s) => s.playerId))];
    },
  };

  const remindedSet = new Set<string>();
  const reminderRepo: ReminderRepo = {
    async wasSent(playerId, matchId) {
      return remindedSet.has(`${playerId}:${matchId}`);
    },
    async markSent(playerId, matchId) {
      remindedSet.add(`${playerId}:${matchId}`);
    },
  };

  const chatMsgs: ChatMessage[] = [];
  const messageRepo: MessageRepo = {
    async add(m) {
      chatMsgs.push({ ...m });
    },
    async listGlobal(limit) {
      return chatMsgs.filter((m) => m.scope === 'global').slice(-limit).map((m) => ({ ...m }));
    },
    async listGroup(groupId, limit) {
      return chatMsgs.filter((m) => m.scope === 'group' && m.groupId === groupId).slice(-limit).map((m) => ({ ...m }));
    },
    async remove(scope, groupId, id) {
      const i = chatMsgs.findIndex((m) => m.id === id && m.scope === scope && (m.groupId ?? null) === (groupId ?? null));
      if (i >= 0) chatMsgs.splice(i, 1);
    },
  };

  return {
    players: playerRepo,
    groups: groupRepo,
    memberships: membershipRepo,
    matches: matchRepo,
    predictions: predictionRepo,
    bracket: bracketRepo,
    goldenBoot: goldenBootRepo,
    darkHorse: darkHorseRepo,
    tournamentWinner: tournamentWinnerRepo,
    pott: pottRepo,
    feedback: feedbackRepo,
    messages: messageRepo,
    stats: statsRepo,
    push: pushRepo,
    reminders: reminderRepo,
  };
}
