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
  BatchWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import type { Group, Match, Prediction } from '@wc2026/shared';
import type { Config } from '../lib/config';
import { NotFoundError } from '../lib/errors';
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
  StatsRepo,
} from './types';
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

// Jittered exponential backoff (mirrors footballApiClient's `250 * 2**i + jitter` pattern, with a
// smaller base) — used to space out BatchWrite UnprocessedItems resends under DynamoDB throttling.
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export function createDynamoRepositories(config: Config): Repositories {
  const doc = createDynamoDocClient(config);
  const Table = config.tableName;

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
      const current = await this.getById(id);
      if (!current) return false;
      // FIX(LOW): casing/whitespace-only rename (e.g. 'bob' -> 'Bob') keeps the same nameKey,
      // so there is no lock to move — but the display name still changed and must be persisted.
      // Previously this returned early WITHOUT updating the profile, diverging from the memory
      // repo (which does persist it). Update the name/updatedAt directly; no lock transaction needed.
      if (current.nameKey === nameKey) {
        if (current.name === name) return true; // genuine no-op
        // FIX(LOW): guard with attribute_exists(PK) like updatePin/setTourSeen — a bare UpdateCommand
        // is an upsert that would fabricate a partial PROFILE row if the player vanished concurrently.
        // rename returns boolean, so treat a failed condition as "not found" → false.
        try {
          await doc.send(
            new UpdateCommand({
              TableName: Table,
              Key: { PK: keys.playerPk(id), SK: 'PROFILE' },
              UpdateExpression: 'SET #n = :n, updatedAt = :u',
              ConditionExpression: 'attribute_exists(PK)',
              ExpressionAttributeNames: { '#n': 'name' },
              ExpressionAttributeValues: { ':n': name, ':u': new Date().toISOString() },
            }),
          );
          return true;
        } catch (err) {
          if (isConditionFailed(err)) return false;
          throw err;
        }
      }
      try {
        // FIX(MED): do the old name-lock delete INSIDE the same TransactWriteItems so the whole
        // rename (acquire new lock + update profile + release old lock) is atomic. Previously the
        // old lock was deleted by a SEPARATE non-transactional DeleteCommand AFTER the commit; if
        // that delete threw a non-ConditionalCheckFailed error the already-committed rename was
        // reported as a failure, leaving an orphaned name-lock that nobody could ever reclaim.
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
              {
                Delete: {
                  TableName: Table,
                  Key: { PK: keys.nameLockPk(current.nameKey), SK: 'LOCK' },
                },
              },
            ],
          }),
        );
        return true;
      } catch (err) {
        if (isConditionFailed(err)) return false;
        throw err;
      }
    },
    async updatePin(id, pinHash) {
      // FIX(LOW): an UpdateCommand with no ConditionExpression is an UPSERT — updating a
      // non-existent player would silently fabricate a partial PROFILE row (only PK/SK/pinHash,
      // missing name/nameKey/etc). Require the row to already exist and surface a NotFoundError.
      try {
        await doc.send(
          new UpdateCommand({
            TableName: Table,
            Key: { PK: keys.playerPk(id), SK: 'PROFILE' },
            UpdateExpression: 'SET pinHash = :p, updatedAt = :u',
            ConditionExpression: 'attribute_exists(PK)',
            ExpressionAttributeValues: { ':p': pinHash, ':u': new Date().toISOString() },
          }),
        );
      } catch (err) {
        if (isConditionFailed(err)) throw new NotFoundError('Player not found');
        throw err;
      }
    },
    async setTourSeen(id, iso) {
      // FIX(LOW): same upsert hazard as updatePin — guard with attribute_exists(PK) so marking the
      // tour seen for a missing player fails loudly instead of fabricating a partial PROFILE row.
      try {
        await doc.send(
          new UpdateCommand({
            TableName: Table,
            Key: { PK: keys.playerPk(id), SK: 'PROFILE' },
            UpdateExpression: 'SET tourSeenAt = :t',
            ConditionExpression: 'attribute_exists(PK)',
            ExpressionAttributeValues: { ':t': iso },
          }),
        );
      } catch (err) {
        if (isConditionFailed(err)) throw new NotFoundError('Player not found');
        throw err;
      }
    },
    async listAll() {
      const items = await scanItems('SK = :sk', { ':sk': 'PROFILE' });
      return items.map((i) => playerFromItem(i));
    },
  };

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
    async getJoinedAt(groupId, playerId) {
      const r = await doc.send(
        new GetCommand({ TableName: Table, Key: { PK: keys.groupPk(groupId), SK: keys.memberSk(playerId) } }),
      );
      return r.Item ? ((r.Item.joinedAt ?? null) as string | null) : null;
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
      // FIX(LOW): a single QueryCommand returns at most one page (capped at 1MB / the implicit
      // page size), so a large group previously left orphaned MEMBER# rows behind. Paginate over
      // LastEvaluatedKey and delete every page. Deletes are chunked into BatchWrite (max 25/req);
      // retry any UnprocessedItems so nothing is silently dropped.
      const toDelete: Array<{ PK: string; SK: string }> = [];
      let ExclusiveStartKey: Record<string, unknown> | undefined;
      do {
        const r = await doc.send(
          new QueryCommand({
            TableName: Table,
            KeyConditionExpression: 'PK = :pk AND begins_with(SK, :m)',
            ExpressionAttributeValues: { ':pk': keys.groupPk(groupId), ':m': 'MEMBER#' },
            ExclusiveStartKey,
          }),
        );
        for (const item of r.Items ?? []) {
          toDelete.push({ PK: item.PK as string, SK: item.SK as string });
        }
        ExclusiveStartKey = r.LastEvaluatedKey as Record<string, unknown> | undefined;
      } while (ExclusiveStartKey);

      for (let i = 0; i < toDelete.length; i += 25) {
        let RequestItems: Record<string, Array<{ DeleteRequest: { Key: { PK: string; SK: string } } }>> = {
          [Table]: toDelete.slice(i, i + 25).map((Key) => ({ DeleteRequest: { Key } })),
        };
        // FIX(MED): BatchWrite can return UnprocessedItems under throttling. Previously this resent
        // immediately with no delay and no cap, so persistent throttling spun/hung this loop
        // indefinitely. Drain with jittered exponential backoff and a bounded attempt cap; if items
        // still remain after the cap, throw so the caller surfaces an error instead of hanging.
        const MAX_ATTEMPTS = 8;
        for (let attempt = 0; ; attempt++) {
          const res = await doc.send(new BatchWriteCommand({ RequestItems }));
          RequestItems = (res.UnprocessedItems ?? {}) as typeof RequestItems;
          if (!RequestItems[Table]?.length) break; // drained — happy path sends once, never sleeps
          if (attempt >= MAX_ATTEMPTS - 1) {
            throw new Error(
              `removeAll: ${RequestItems[Table].length} item(s) still unprocessed after ${MAX_ATTEMPTS} BatchWrite attempts`,
            );
          }
          await sleep(50 * 2 ** attempt + Math.floor(Math.random() * 50));
        }
      }
    },
  };

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
      // READ-AMPLIFICATION (SCOPED-DOWN, do not change keys without a migration):
      // Predictions and bracket picks share the same GSI1 partition for a match
      // (GSI1PK = MATCH#<id>). Both query that partition and then FilterExpression-DISCARD the
      // sibling type. Filtering happens AFTER read, so for every prediction we also read+pay for
      // every bracket pick on the same match (and vice-versa) — wasted RCUs that grow with the
      // sibling count. The proper fix is to make the row type part of the GSI1 SORT key, e.g.
      // GSI1SK = 'PRED#'<playerId> vs 'BRK#'<playerId>, then narrow with
      // KeyConditionExpression begins_with(GSI1SK, 'PRED#') and drop the FilterExpression. That is
      // a GSI1SK key-schema change requiring a backfill/migration of existing items, so it is
      // intentionally NOT done here.
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
      // READ-AMPLIFICATION (SCOPED-DOWN): mirror of predictions.listByMatch above. Bracket picks
      // share the GSI1 partition (GSI1PK = MATCH#<id>) with predictions, so this query reads both
      // types and then FilterExpression-discards the predictions. Fixing it properly means encoding
      // the row type into GSI1SK (e.g. 'BRK#'<playerId>) and using begins_with on the key instead
      // of a post-read FilterExpression — a GSI1SK key-schema change that needs a data migration,
      // so it is deliberately left as-is here. See the matching note in predictions.listByMatch.
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
  };

  return { players, groups, memberships, matches, predictions, bracket, goldenBoot, darkHorse, tournamentWinner, pott, feedback, stats };
}
