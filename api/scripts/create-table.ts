// Creates the single-table schema in DynamoDB Local (or AWS). Run after `docker compose up -d`.
import {
  DynamoDBClient,
  CreateTableCommand,
  DescribeTableCommand,
  type CreateTableCommandInput,
} from '@aws-sdk/client-dynamodb';
import { loadConfig } from '../src/lib/config';

const config = loadConfig();
const client = new DynamoDBClient({
  region: config.awsRegion,
  ...(config.dynamoEndpoint ? { endpoint: config.dynamoEndpoint } : {}),
});

const input: CreateTableCommandInput = {
  TableName: config.tableName,
  BillingMode: 'PAY_PER_REQUEST',
  AttributeDefinitions: [
    { AttributeName: 'PK', AttributeType: 'S' },
    { AttributeName: 'SK', AttributeType: 'S' },
    { AttributeName: 'GSI1PK', AttributeType: 'S' },
    { AttributeName: 'GSI1SK', AttributeType: 'S' },
    { AttributeName: 'GSI2PK', AttributeType: 'S' },
    { AttributeName: 'GSI2SK', AttributeType: 'S' },
    { AttributeName: 'GSI3PK', AttributeType: 'S' },
    { AttributeName: 'GSI3SK', AttributeType: 'S' },
  ],
  KeySchema: [
    { AttributeName: 'PK', KeyType: 'HASH' },
    { AttributeName: 'SK', KeyType: 'RANGE' },
  ],
  GlobalSecondaryIndexes: [
    {
      IndexName: 'GSI1',
      KeySchema: [
        { AttributeName: 'GSI1PK', KeyType: 'HASH' },
        { AttributeName: 'GSI1SK', KeyType: 'RANGE' },
      ],
      Projection: { ProjectionType: 'ALL' },
    },
    {
      IndexName: 'GSI2',
      KeySchema: [
        { AttributeName: 'GSI2PK', KeyType: 'HASH' },
        { AttributeName: 'GSI2SK', KeyType: 'RANGE' },
      ],
      Projection: { ProjectionType: 'ALL' },
    },
    {
      IndexName: 'GSI3',
      KeySchema: [
        { AttributeName: 'GSI3PK', KeyType: 'HASH' },
        { AttributeName: 'GSI3SK', KeyType: 'RANGE' },
      ],
      Projection: { ProjectionType: 'ALL' },
    },
  ],
};

async function main(): Promise<void> {
  try {
    await client.send(new DescribeTableCommand({ TableName: config.tableName }));
    console.log(`Table ${config.tableName} already exists.`);
    return;
  } catch {
    // not found — create it
  }
  await client.send(new CreateTableCommand(input));
  console.log(`Created table ${config.tableName}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
