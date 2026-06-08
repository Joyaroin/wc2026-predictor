// In-memory repositories — used by automated tests and the optional PERSISTENCE=memory mode.
import type { Group, Match, Prediction } from '@wc2026/shared';
import type {
  Repositories,
  PlayerRepo,
  PlayerRecord,
  GroupRepo,
  MembershipRepo,
  MatchRepo,
  PredictionRepo,
} from './types';

export function createMemoryRepositories(): Repositories {
  const players = new Map<string, PlayerRecord>();
  const nameIndex = new Map<string, string>(); // nameKey -> playerId
  const groups = new Map<string, Group>();
  const codeIndex = new Map<string, string>(); // inviteCode -> groupId
  const members = new Map<string, Set<string>>(); // groupId -> playerIds
  const matches = new Map<string, Match>();
  const predictions = new Map<string, Prediction>(); // `${playerId}|${matchId}`

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
    async get(playerId, matchId) {
      return predictions.get(predKey(playerId, matchId)) ?? null;
    },
    async listByPlayer(playerId) {
      return [...predictions.values()].filter((p) => p.playerId === playerId);
    },
    async listByMatch(matchId) {
      return [...predictions.values()].filter((p) => p.matchId === matchId);
    },
  };

  return {
    players: playerRepo,
    groups: groupRepo,
    memberships: membershipRepo,
    matches: matchRepo,
    predictions: predictionRepo,
  };
}
