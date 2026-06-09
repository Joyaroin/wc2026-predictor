// Pure mappers: domain object <-> DynamoDB single-table item. Exported for round-trip property tests (PBT-02).
import type { Group, Match, Prediction, BracketPick } from '@wc2026/shared';
import type { PlayerRecord } from './types';

export type Item = Record<string, unknown>;

export const keys = {
  playerPk: (id: string) => `PLAYER#${id}`,
  groupPk: (id: string) => `GROUP#${id}`,
  matchPk: (id: string) => `MATCH#${id}`,
  nameLockPk: (nameKey: string) => `NAME#${nameKey}`,
  codeGsi: (code: string) => `CODE#${code}`,
  memberSk: (playerId: string) => `MEMBER#${playerId}`,
  predSk: (matchId: string) => `PRED#${matchId}`,
  brkSk: (matchId: string) => `BRK#${matchId}`,
};

// --- Player ---
export function playerToItem(p: PlayerRecord): Item {
  return {
    PK: keys.playerPk(p.id),
    SK: 'PROFILE',
    id: p.id,
    name: p.name,
    nameKey: p.nameKey,
    pinHash: p.pinHash,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}
export function playerFromItem(item: Item): PlayerRecord {
  return {
    id: item.id as string,
    name: item.name as string,
    nameKey: item.nameKey as string,
    pinHash: item.pinHash as string,
    createdAt: item.createdAt as string,
    updatedAt: item.updatedAt as string,
  };
}

// --- Group ---
export function groupToItem(g: Group): Item {
  return {
    PK: keys.groupPk(g.id),
    SK: 'META',
    GSI1PK: keys.codeGsi(g.inviteCode),
    GSI1SK: keys.groupPk(g.id),
    id: g.id,
    name: g.name,
    inviteCode: g.inviteCode,
    createdBy: g.createdBy,
    createdAt: g.createdAt,
  };
}
export function groupFromItem(item: Item): Group {
  return {
    id: item.id as string,
    name: item.name as string,
    inviteCode: item.inviteCode as string,
    createdBy: item.createdBy as string,
    createdAt: item.createdAt as string,
  };
}

// --- Match ---
export function matchToItem(m: Match): Item {
  return {
    PK: keys.matchPk(m.id),
    SK: 'META',
    GSI2PK: 'SCHEDULE',
    GSI2SK: `${m.kickoff}#${m.id}`,
    ...m,
  };
}
export function matchFromItem(item: Item): Match {
  return {
    id: item.id as string,
    stage: item.stage as Match['stage'],
    groupName: (item.groupName ?? null) as string | null,
    matchday: (item.matchday ?? null) as number | null,
    homeTeam: item.homeTeam as string,
    homeCode: (item.homeCode ?? null) as string | null,
    awayTeam: item.awayTeam as string,
    awayCode: (item.awayCode ?? null) as string | null,
    kickoff: item.kickoff as string,
    status: item.status as Match['status'],
    homeScore: (item.homeScore ?? null) as number | null,
    awayScore: (item.awayScore ?? null) as number | null,
    winner: (item.winner ?? null) as Match['winner'],
    placeholder: item.placeholder as boolean,
  };
}

// --- Bracket pick ---
export function bracketToItem(b: BracketPick): Item {
  return {
    PK: keys.playerPk(b.playerId),
    SK: keys.brkSk(b.matchId),
    GSI1PK: keys.matchPk(b.matchId),
    GSI1SK: keys.playerPk(b.playerId),
    playerId: b.playerId,
    matchId: b.matchId,
    side: b.side,
    teamName: b.teamName,
    points: b.points,
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
  };
}
export function bracketFromItem(item: Item): BracketPick {
  return {
    playerId: item.playerId as string,
    matchId: item.matchId as string,
    side: item.side as BracketPick['side'],
    teamName: item.teamName as string,
    points: item.points as number,
    createdAt: item.createdAt as string,
    updatedAt: item.updatedAt as string,
  };
}

// --- Prediction ---
export function predictionToItem(p: Prediction): Item {
  return {
    PK: keys.playerPk(p.playerId),
    SK: keys.predSk(p.matchId),
    GSI1PK: keys.matchPk(p.matchId),
    GSI1SK: keys.playerPk(p.playerId),
    playerId: p.playerId,
    matchId: p.matchId,
    home: p.home,
    away: p.away,
    points: p.points,
    joker: p.joker ?? false,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}
export function predictionFromItem(item: Item): Prediction {
  return {
    playerId: item.playerId as string,
    matchId: item.matchId as string,
    home: item.home as number,
    away: item.away as number,
    points: item.points as Prediction['points'],
    joker: (item.joker ?? false) as boolean,
    createdAt: item.createdAt as string,
    updatedAt: item.updatedAt as string,
  };
}
