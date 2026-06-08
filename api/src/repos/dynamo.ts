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
          ExpressionAttributeValues: { ':pk': keys.matchPk(matchId) },
        }),
      );
      return (r.Items ?? []).map((i) => predictionFromItem(i as Item));
    },
    async scanAll() {
      const items = await scanItems('begins_with(SK, :p)', { ':p': 'PRED#' });
      return items.map((i) => predictionFromItem(i));
    },
  };

  return { players, groups, memberships, matches, predictions };
}
