// DynamoDB single-table repositories (AWS SDK v3 Document client). Used in AWS / DynamoDB-Local.
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  TransactWriteCommand,
  DeleteCommand,
  UpdateCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';
import type { Group, Match, Prediction } from '@wc2026/shared';
import type { Config } from '../lib/config';
import type {
  Repositories,
  PlayerRepo,
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
  MessageRepo,
  ChatMessage,
  StatsRepo,
  PushRepo,
  ReminderRepo,
} from './types';
import { DEFAULT_FLAGS } from './types';
import {
  keys,
  playerToItem,
  playerFromItem,
  groupToItem,
  groupFromItem,
  matchToItem,
  matchFromItem,
  predictionToItem,
  predictionFromItem,
  bracketToItem,
  bracketFromItem,
  type Item,
} from './mappers';

export function createDynamoDocClient(config: Config): DynamoDBDocumentClient {
  const base = new DynamoDBClient({
    region: config.awsRegion,
    ...(config.dynamoEndpoint ? { endpoint: config.dynamoEndpoint } : {}),
  });
  return DynamoDBDocumentClient.from(base, {
    marshallOptions: { removeUndefinedValues: true },
  });
}

function isConditionFailed(err: unknown): boolean {
  const name = (err as { name?: string } | null)?.name ?? '';
  return name === 'ConditionalCheckFailedException' || name === 'TransactionCanceledException';
}

// Single-table design: every entity lives in one table, distinguished by its PK/SK prefix
// (see mappers.ts `keys`). Two global secondary indexes give the reverse/scan access patterns:
//   GSI1 — reverse lookups: group invite-code → group, match → its predictions/brackets, player → groups.
//   GSI2 — the "SCHEDULE" partition: all matches under one PK, sorted by kickoff, for listAll().
// Prefer Query (targeted, cheap) over Scan; Scan is only used for the "everyone" reads (leaderboards).
export function createDynamoRepositories(config: Config): Repositories {
  const doc = createDynamoDocClient(config);
  const Table = config.tableName;

  // Paginated full-table Scan with a filter — used only where we genuinely need every item of a
  // kind (global leaderboard, award tallies, push subscribers). Walks LastEvaluatedKey to completion.
  async function scanItems(filter: string, values: Record<string, unknown>): Promise<Item[]> {
    const items: Item[] = [];
    let ExclusiveStartKey: Record<string, unknown> | undefined;
    do {
      const r = await doc.send(
        new ScanCommand({ TableName: Table, FilterExpression: filter, ExpressionAttributeValues: values, ExclusiveStartKey }),
      );
      items.push(...((r.Items ?? []) as Item[]));
      ExclusiveStartKey = r.LastEvaluatedKey as Record<string, unknown> | undefined;
    } while (ExclusiveStartKey);
    return items;
  }

  // Players: profile lives at PLAYER#<id>/PROFILE. Name uniqueness is enforced by a separate
  // NAME#<nameKey>/LOCK item written in the same transaction (see create/rename below).
  const players: PlayerRepo = {
    async getById(id) {
      const r = await doc.send(new GetCommand({ TableName: Table, Key: { PK: keys.playerPk(id), SK: 'PROFILE' } }));
      return r.Item ? playerFromItem(r.Item as Item) : null;
    },
    async getByNameKey(nameKey) {
      const lock = await doc.send(
        new GetCommand({ TableName: Table, Key: { PK: keys.nameLockPk(nameKey), SK: 'LOCK' } }),
      );
      if (!lock.Item) return null;
      return this.getById(lock.Item.playerId as string);
    },
    async create(rec) {
      // Atomic register: claim the NAME# lock (fails if the name is taken) and write the PROFILE
      // together, so two people picking the same name at once can't both succeed.
      try {
        await doc.send(
          new TransactWriteCommand({
            TransactItems: [
              {
                Put: {
                  TableName: Table,
                  Item: { PK: keys.nameLockPk(rec.nameKey), SK: 'LOCK', playerId: rec.id },
                  ConditionExpression: 'attribute_not_exists(PK)',
                },
              },
              { Put: { TableName: Table, Item: playerToItem(rec) } },
            ],
          }),
        );
        return true;
      } catch (err) {
        if (isConditionFailed(err)) return false;
        throw err;
      }
    },
    async rename(id, name, nameKey) {
      // Claim the new name lock + update the profile atomically; only after that succeeds do we
      // release the old lock. Order matters: never free the old name before the new one is secured.
      const current = await this.getById(id);
      if (!current) return false;
      if (current.nameKey === nameKey) return true;
      try {
        await doc.send(
          new TransactWriteCommand({
            TransactItems: [
              {
                Put: {
                  TableName: Table,
                  Item: { PK: keys.nameLockPk(nameKey), SK: 'LOCK', playerId: id },
                  ConditionExpression: 'attribute_not_exists(PK)',
                },
              },
              {
                Update: {
                  TableName: Table,
                  Key: { PK: keys.playerPk(id), SK: 'PROFILE' },
                  UpdateExpression: 'SET #n = :n, nameKey = :nk, updatedAt = :u',
                  ExpressionAttributeNames: { '#n': 'name' },
                  ExpressionAttributeValues: { ':n': name, ':nk': nameKey, ':u': new Date().toISOString() },
                },
              },
            ],
          }),
        );
        await doc.send(
          new DeleteCommand({ TableName: Table, Key: { PK: keys.nameLockPk(current.nameKey), SK: 'LOCK' } }),
        );
        return true;
      } catch (err) {
        if (isConditionFailed(err)) return false;
        throw err;
      }
    },
    async updatePin(id, pinHash) {
      await doc.send(
        new UpdateCommand({
          TableName: Table,
          Key: { PK: keys.playerPk(id), SK: 'PROFILE' },
          UpdateExpression: 'SET pinHash = :p, updatedAt = :u',
          ExpressionAttributeValues: { ':p': pinHash, ':u': new Date().toISOString() },
        }),
      );
    },
    async setAvatarColor(id, color) {
      await doc.send(
        new UpdateCommand({
          TableName: Table,
          Key: { PK: keys.playerPk(id), SK: 'PROFILE' },
          UpdateExpression: 'SET avatarColor = :c',
          ExpressionAttributeValues: { ':c': color },
        }),
      );
    },
    async setTourSeen(id, iso) {
      await doc.send(
        new UpdateCommand({
          TableName: Table,
          Key: { PK: keys.playerPk(id), SK: 'PROFILE' },
          UpdateExpression: 'SET tourSeenAt = :t',
          ExpressionAttributeValues: { ':t': iso },
        }),
      );
    },
    async listAll() {
      const items = await scanItems('SK = :sk', { ':sk': 'PROFILE' });
      return items.map((i) => playerFromItem(i));
    },
  };

  // Groups: META item at GROUP#<id>/META, projected onto GSI1 by invite code so join-by-code is a
  // single indexed Query. Deleting META also removes the group from GSI1 (same item).
  const groups: GroupRepo = {
    async create(group: Group) {
      await doc.send(new PutCommand({ TableName: Table, Item: groupToItem(group) }));
    },
    async getById(id) {
      const r = await doc.send(new GetCommand({ TableName: Table, Key: { PK: keys.groupPk(id), SK: 'META' } }));
      return r.Item ? groupFromItem(r.Item as Item) : null;
    },
    async getByInviteCode(code) {
      const r = await doc.send(
        new QueryCommand({
          TableName: Table,
          IndexName: 'GSI1',
          KeyConditionExpression: 'GSI1PK = :pk',
          ExpressionAttributeValues: { ':pk': keys.codeGsi(code) },
          Limit: 1,
        }),
      );
      const item = r.Items?.[0];
      return item ? groupFromItem(item as Item) : null;
    },
    async delete(groupId) {
      // Deleting the META item also removes the invite-code GSI projection (same item).
      await doc.send(new DeleteCommand({ TableName: Table, Key: { PK: keys.groupPk(groupId), SK: 'META' } }));
    },
  };

  // Memberships: one item per (group, player) under the group's PK — so "who's in this group" is a
  // Query on PK, and "which groups is this player in" is the same item read back via GSI1 (player PK).
  const memberships: MembershipRepo = {
    async add(groupId, playerId, joinedAt) {
      await doc.send(
        new PutCommand({
          TableName: Table,
          Item: {
            PK: keys.groupPk(groupId),
            SK: keys.memberSk(playerId),
            GSI1PK: keys.playerPk(playerId),
            GSI1SK: keys.groupPk(groupId),
            joinedAt,
          },
        }),
      );
    },
    async isMember(groupId, playerId) {
      const r = await doc.send(
        new GetCommand({ TableName: Table, Key: { PK: keys.groupPk(groupId), SK: keys.memberSk(playerId) } }),
      );
      return Boolean(r.Item);
    },
    async listMembers(groupId) {
      const r = await doc.send(
        new QueryCommand({
          TableName: Table,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :m)',
          ExpressionAttributeValues: { ':pk': keys.groupPk(groupId), ':m': 'MEMBER#' },
        }),
      );
      return (r.Items ?? []).map((i) => (i.SK as string).slice('MEMBER#'.length));
    },
    async listGroups(playerId) {
      const r = await doc.send(
        new QueryCommand({
          TableName: Table,
          IndexName: 'GSI1',
          KeyConditionExpression: 'GSI1PK = :pk AND begins_with(GSI1SK, :g)',
          ExpressionAttributeValues: { ':pk': keys.playerPk(playerId), ':g': 'GROUP#' },
        }),
      );
      return (r.Items ?? []).map((i) => (i.GSI1SK as string).slice('GROUP#'.length));
    },
    async remove(groupId, playerId) {
      await doc.send(
        new DeleteCommand({ TableName: Table, Key: { PK: keys.groupPk(groupId), SK: keys.memberSk(playerId) } }),
      );
    },
    async removeAll(groupId) {
      const r = await doc.send(
        new QueryCommand({
          TableName: Table,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :m)',
          ExpressionAttributeValues: { ':pk': keys.groupPk(groupId), ':m': 'MEMBER#' },
        }),
      );
      for (const item of r.Items ?? []) {
        await doc.send(
          new DeleteCommand({ TableName: Table, Key: { PK: item.PK as string, SK: item.SK as string } }),
        );
      }
    },
  };

  // Matches: each at MATCH#<id>/META, all sharing GSI2 partition "SCHEDULE" keyed by "<kickoff>#<id>"
  // so listAll() returns the whole fixture list already ordered by kickoff via one paginated Query.
  const matches: MatchRepo = {
    async upsert(match: Match) {
      await doc.send(new PutCommand({ TableName: Table, Item: matchToItem(match) }));
    },
    async getById(id) {
      const r = await doc.send(new GetCommand({ TableName: Table, Key: { PK: keys.matchPk(id), SK: 'META' } }));
      return r.Item ? matchFromItem(r.Item as Item) : null;
    },
    async listAll() {
      const items: Item[] = [];
      let ExclusiveStartKey: Record<string, unknown> | undefined;
      do {
        const r = await doc.send(
          new QueryCommand({
            TableName: Table,
            IndexName: 'GSI2',
            KeyConditionExpression: 'GSI2PK = :s',
            ExpressionAttributeValues: { ':s': 'SCHEDULE' },
            ExclusiveStartKey,
          }),
        );
        items.push(...((r.Items ?? []) as Item[]));
        ExclusiveStartKey = r.LastEvaluatedKey as Record<string, unknown> | undefined;
      } while (ExclusiveStartKey);
      return items.map(matchFromItem);
    },
  };

  // Predictions: stored under the owner (PLAYER#<id>/PRED#<matchId>) so a player's picks are one
  // Query; mirrored onto GSI1 by match so "everyone's picks for this match" is also one Query.
  const predictions: PredictionRepo = {
    async put(prediction: Prediction) {
      await doc.send(new PutCommand({ TableName: Table, Item: predictionToItem(prediction) }));
    },
    async delete(playerId, matchId) {
      await doc.send(
        new DeleteCommand({ TableName: Table, Key: { PK: keys.playerPk(playerId), SK: keys.predSk(matchId) } }),
      );
    },
    async get(playerId, matchId) {
      const r = await doc.send(
        new GetCommand({ TableName: Table, Key: { PK: keys.playerPk(playerId), SK: keys.predSk(matchId) } }),
      );
      return r.Item ? predictionFromItem(r.Item as Item) : null;
    },
    async listByPlayer(playerId) {
      const r = await doc.send(
        new QueryCommand({
          TableName: Table,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :p)',
          ExpressionAttributeValues: { ':pk': keys.playerPk(playerId), ':p': 'PRED#' },
        }),
      );
      return (r.Items ?? []).map((i) => predictionFromItem(i as Item));
    },
    async listByMatch(matchId) {
      const r = await doc.send(
        new QueryCommand({
          TableName: Table,
          IndexName: 'GSI1',
          KeyConditionExpression: 'GSI1PK = :pk',
          FilterExpression: 'begins_with(SK, :p)',
          ExpressionAttributeValues: { ':pk': keys.matchPk(matchId), ':p': 'PRED#' },
        }),
      );
      return (r.Items ?? []).map((i) => predictionFromItem(i as Item));
    },
    async scanAll() {
      const items = await scanItems('begins_with(SK, :p)', { ':p': 'PRED#' });
      return items.map((i) => predictionFromItem(i));
    },
  };

  // Bracket (knockout advancement) picks: same dual-access shape as predictions — owner PK for
  // "my picks", GSI1 by match for "everyone's picks on this tie".
  const bracket: BracketRepo = {
    async put(pick) {
      await doc.send(new PutCommand({ TableName: Table, Item: bracketToItem(pick) }));
    },
    async get(playerId, matchId) {
      const r = await doc.send(
        new GetCommand({ TableName: Table, Key: { PK: keys.playerPk(playerId), SK: keys.brkSk(matchId) } }),
      );
      return r.Item ? bracketFromItem(r.Item as Item) : null;
    },
    async listByPlayer(playerId) {
      const r = await doc.send(
        new QueryCommand({
          TableName: Table,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :b)',
          ExpressionAttributeValues: { ':pk': keys.playerPk(playerId), ':b': 'BRK#' },
        }),
      );
      return (r.Items ?? []).map((i) => bracketFromItem(i as Item));
    },
    async listByMatch(matchId) {
      const r = await doc.send(
        new QueryCommand({
          TableName: Table,
          IndexName: 'GSI1',
          KeyConditionExpression: 'GSI1PK = :pk',
          FilterExpression: 'begins_with(SK, :b)',
          ExpressionAttributeValues: { ':pk': keys.matchPk(matchId), ':b': 'BRK#' },
        }),
      );
      return (r.Items ?? []).map((i) => bracketFromItem(i as Item));
    },
    async scanAll() {
      const items = await scanItems('begins_with(SK, :b)', { ':b': 'BRK#' });
      return items.map((i) => bracketFromItem(i));
    },
  };

  // Season-long award picks (Golden Boot / Dark Horse / Tournament Winner / Player of the Tournament):
  // each is a single fixed-SK item per player (one pick each), so get() is a point read and scanAll()
  // gathers everyone's for live award scoring. Below, one <award>FromItem mapper + repo per award.
  const gbFromItem = (i: Item): GoldenBootPick => ({
    playerId: i.playerId as string,
    scorerId: i.scorerId as string,
    scorerName: i.scorerName as string,
    points: i.points as number,
    createdAt: i.createdAt as string,
    updatedAt: i.updatedAt as string,
  });

  const goldenBoot: GoldenBootRepo = {
    async put(pick) {
      await doc.send(
        new PutCommand({ TableName: Table, Item: { PK: keys.playerPk(pick.playerId), SK: 'GBPICK', ...pick } }),
      );
    },
    async get(playerId) {
      const r = await doc.send(
        new GetCommand({ TableName: Table, Key: { PK: keys.playerPk(playerId), SK: 'GBPICK' } }),
      );
      return r.Item ? gbFromItem(r.Item as Item) : null;
    },
    async scanAll() {
      const items = await scanItems('SK = :sk', { ':sk': 'GBPICK' });
      return items.map((i) => gbFromItem(i));
    },
  };

  const dhFromItem = (i: Item): DarkHorsePick => ({
    playerId: i.playerId as string,
    teamCode: i.teamCode as string,
    teamName: i.teamName as string,
    points: i.points as number,
    createdAt: i.createdAt as string,
    updatedAt: i.updatedAt as string,
  });

  const darkHorse: DarkHorseRepo = {
    async put(pick) {
      await doc.send(
        new PutCommand({ TableName: Table, Item: { PK: keys.playerPk(pick.playerId), SK: 'DHPICK', ...pick } }),
      );
    },
    async get(playerId) {
      const r = await doc.send(
        new GetCommand({ TableName: Table, Key: { PK: keys.playerPk(playerId), SK: 'DHPICK' } }),
      );
      return r.Item ? dhFromItem(r.Item as Item) : null;
    },
    async scanAll() {
      const items = await scanItems('SK = :sk', { ':sk': 'DHPICK' });
      return items.map((i) => dhFromItem(i));
    },
  };

  const twFromItem = (i: Item): TournamentWinnerPick => ({
    playerId: i.playerId as string,
    teamCode: i.teamCode as string,
    teamName: i.teamName as string,
    points: i.points as number,
    createdAt: i.createdAt as string,
    updatedAt: i.updatedAt as string,
  });

  const tournamentWinner: TournamentWinnerRepo = {
    async put(pick) {
      await doc.send(
        new PutCommand({ TableName: Table, Item: { PK: keys.playerPk(pick.playerId), SK: 'TWPICK', ...pick } }),
      );
    },
    async get(playerId) {
      const r = await doc.send(
        new GetCommand({ TableName: Table, Key: { PK: keys.playerPk(playerId), SK: 'TWPICK' } }),
      );
      return r.Item ? twFromItem(r.Item as Item) : null;
    },
    async scanAll() {
      const items = await scanItems('SK = :sk', { ':sk': 'TWPICK' });
      return items.map((i) => twFromItem(i));
    },
  };

  const pottFromItem = (i: Item): PottPick => ({
    playerId: i.playerId as string,
    winnerId: i.winnerId as string,
    winnerName: i.winnerName as string,
    points: i.points as number,
    createdAt: i.createdAt as string,
    updatedAt: i.updatedAt as string,
  });

  const pott: PottRepo = {
    async put(pick) {
      await doc.send(
        new PutCommand({ TableName: Table, Item: { PK: keys.playerPk(pick.playerId), SK: 'POTTPICK', ...pick } }),
      );
    },
    async get(playerId) {
      const r = await doc.send(
        new GetCommand({ TableName: Table, Key: { PK: keys.playerPk(playerId), SK: 'POTTPICK' } }),
      );
      return r.Item ? pottFromItem(r.Item as Item) : null;
    },
    async scanAll() {
      const items = await scanItems('SK = :sk', { ':sk': 'POTTPICK' });
      return items.map((i) => pottFromItem(i));
    },
  };

  // Feedback: all bug reports share PK 'FEEDBACK', SK '<createdAt>#<id>' so a single Query returns
  // them time-ordered (ScanIndexForward:false = newest first) for the admin inbox.
  const feedback: FeedbackRepo = {
    async add(item) {
      await doc.send(
        new PutCommand({ TableName: Table, Item: { PK: 'FEEDBACK', SK: `${item.createdAt}#${item.id}`, ...item } }),
      );
    },
    async listAll() {
      const r = await doc.send(
        new QueryCommand({
          TableName: Table,
          KeyConditionExpression: 'PK = :pk',
          ExpressionAttributeValues: { ':pk': 'FEEDBACK' },
          ScanIndexForward: false, // newest first
        }),
      );
      return (r.Items ?? []).map((i) => ({
        id: i.id as string,
        playerId: i.playerId as string,
        playerName: i.playerName as string,
        message: i.message as string,
        page: (i.page ?? null) as string | null,
        createdAt: i.createdAt as string,
      }));
    },
  };

  // Chat: one partition per feed (CHAT#GLOBAL or CHAT#GROUP#<id>), SK 'MSG#<ts>_<rand>' so messages
  // sort by time. Reads take the newest N (ScanIndexForward:false + Limit) then reverse to oldest→newest.
  const msgFromItem = (i: Item): ChatMessage => ({
    id: i.id as string,
    scope: i.scope as 'global' | 'group',
    groupId: (i.groupId ?? null) as string | null,
    playerId: i.playerId as string,
    playerName: i.playerName as string,
    avatarColor: (i.avatarColor ?? null) as string | null,
    text: i.text as string,
    createdAt: i.createdAt as string,
  });
  const chatPk = (scope: 'global' | 'group', groupId: string | null): string =>
    scope === 'global' ? keys.chatGlobalPk() : keys.chatGroupPk(groupId ?? '');
  const queryRecentMessages = async (pk: string, limit: number): Promise<ChatMessage[]> => {
    const r = await doc.send(
      new QueryCommand({
        TableName: Table,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :m)',
        ExpressionAttributeValues: { ':pk': pk, ':m': 'MSG#' },
        ScanIndexForward: false, // newest first
        Limit: limit,
      }),
    );
    return (r.Items ?? []).map((i) => msgFromItem(i as Item)).reverse(); // oldest→newest for display
  };
  const messages: MessageRepo = {
    async add(m) {
      await doc.send(
        new PutCommand({ TableName: Table, Item: { PK: chatPk(m.scope, m.groupId), SK: keys.msgSk(m.id), ...m } }),
      );
    },
    listGlobal: (limit) => queryRecentMessages(keys.chatGlobalPk(), limit),
    listGroup: (groupId, limit) => queryRecentMessages(keys.chatGroupPk(groupId), limit),
    async remove(scope, groupId, id) {
      await doc.send(new DeleteCommand({ TableName: Table, Key: { PK: chatPk(scope, groupId), SK: keys.msgSk(id) } }));
    },
  };

  // Stats: a small set of singleton records under PK 'STATS' — the live top scorer (LEADER), last
  // ESPN sync time (META), the admin-set POTT winner (POTT), and runtime feature flags (FLAGS).
  const stats: StatsRepo = {
    async getLeader() {
      const r = await doc.send(new GetCommand({ TableName: Table, Key: { PK: 'STATS', SK: 'LEADER' } }));
      if (!r.Item) return null;
      return { scorerId: r.Item.scorerId as string, scorerName: r.Item.scorerName as string, goals: r.Item.goals as number };
    },
    async setLeader(l) {
      await doc.send(new PutCommand({ TableName: Table, Item: { PK: 'STATS', SK: 'LEADER', ...l } }));
    },
    async getLastEspnRun() {
      const r = await doc.send(new GetCommand({ TableName: Table, Key: { PK: 'STATS', SK: 'META' } }));
      return r.Item ? ((r.Item.lastEspnRun ?? null) as string | null) : null;
    },
    async setLastEspnRun(iso) {
      await doc.send(new PutCommand({ TableName: Table, Item: { PK: 'STATS', SK: 'META', lastEspnRun: iso } }));
    },
    async getPottWinner() {
      const r = await doc.send(new GetCommand({ TableName: Table, Key: { PK: 'STATS', SK: 'POTT' } }));
      return r.Item ? { id: r.Item.id as string, name: r.Item.name as string } : null;
    },
    async setPottWinner(w) {
      await doc.send(new PutCommand({ TableName: Table, Item: { PK: 'STATS', SK: 'POTT', ...w } }));
    },
    async getFlags() {
      const r = await doc.send(new GetCommand({ TableName: Table, Key: { PK: 'STATS', SK: 'FLAGS' } }));
      return {
        ...DEFAULT_FLAGS,
        ...(typeof r.Item?.adsEnabled === 'boolean' ? { adsEnabled: r.Item.adsEnabled } : {}),
        ...(typeof r.Item?.assistantEnabled === 'boolean' ? { assistantEnabled: r.Item.assistantEnabled } : {}),
      };
    },
    async setFlags(patch) {
      const current = await this.getFlags();
      const next = { ...current, ...patch };
      await doc.send(new PutCommand({ TableName: Table, Item: { PK: 'STATS', SK: 'FLAGS', ...next } }));
      return next;
    },
  };

  // Web Push subscriptions: PLAYER#<id>/PUSH#<endpoint> (a player may have several devices).
  // Reminders below use PLAYER#<id>/REMIND#<matchId> as a once-only "already nudged" marker.
  const push: PushRepo = {
    async save(sub) {
      await doc.send(new PutCommand({
        TableName: Table,
        Item: {
          PK: keys.playerPk(sub.playerId), SK: `PUSH#${sub.endpoint}`,
          playerId: sub.playerId, endpoint: sub.endpoint,
          p256dh: sub.keys.p256dh, auth: sub.keys.auth, createdAt: sub.createdAt,
        },
      }));
    },
    async listByPlayer(playerId) {
      const r = await doc.send(new QueryCommand({
        TableName: Table,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :s)',
        ExpressionAttributeValues: { ':pk': keys.playerPk(playerId), ':s': 'PUSH#' },
      }));
      return (r.Items ?? []).map((i) => ({
        playerId, endpoint: i.endpoint as string,
        keys: { p256dh: i.p256dh as string, auth: i.auth as string },
        createdAt: i.createdAt as string,
      }));
    },
    async remove(playerId, endpoint) {
      await doc.send(new DeleteCommand({ TableName: Table, Key: { PK: keys.playerPk(playerId), SK: `PUSH#${endpoint}` } }));
    },
    async listSubscribers() {
      const items = await scanItems('begins_with(SK, :s)', { ':s': 'PUSH#' });
      return [...new Set(items.map((i) => i.playerId as string))];
    },
  };

  const reminders: ReminderRepo = {
    async wasSent(playerId, matchId) {
      const r = await doc.send(new GetCommand({ TableName: Table, Key: { PK: keys.playerPk(playerId), SK: `REMIND#${matchId}` } }));
      return !!r.Item;
    },
    async markSent(playerId, matchId) {
      await doc.send(new PutCommand({ TableName: Table, Item: { PK: keys.playerPk(playerId), SK: `REMIND#${matchId}`, at: new Date().toISOString() } }));
    },
  };

  return { players, groups, memberships, matches, predictions, bracket, goldenBoot, darkHorse, tournamentWinner, pott, feedback, messages, stats, push, reminders };
}
