/**
 * One-time backfill: stamp GSI3PK/GSI3SK onto existing items so the GSI3 "list-all" queries
 * (players, predictions, bracket/award picks, push subscriptions) return complete data.
 *
 * Why it's needed: DynamoDB only indexes items that carry the index's key attributes. New
 * writes set GSI3 keys automatically (see repos/mappers.ts + repos/dynamo.ts), but rows that
 * existed before that change have none, so a GSI3 Query would silently omit them. Run this once
 * per table AFTER `terraform apply` adds the GSI3 index and BEFORE flipping USE_GSI_LISTS=true.
 *
 * Safe to re-run (idempotent): it only sets the two attributes and skips items that already
 * have them. Reads/writes are paginated. Requires the same AWS creds/region as the app
 * (locally: TABLE_NAME + AWS creds in env; in-cluster: run as a Job using the node role).
 *
 *   TABLE_NAME=wc2026-dev AWS_REGION=us-east-2 npm run backfill-gsi3 --workspace @wc2026/api
 */
import { ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { loadConfig } from '../src/lib/config';
import { createDynamoDocClient } from '../src/repos/dynamo';
import { gsi3 } from '../src/repos/mappers';

type Item = Record<string, unknown>;

// Derive the GSI3 partition + sort key for a legacy item from its SK/fields. Returns null for
// item types that are not "list-all" collections (they don't belong in GSI3).
function gsi3KeysFor(item: Item): { pk: string; sk: string } | null {
  const sk = String(item.SK ?? '');
  const pk = String(item.PK ?? '');
  const playerId = (item.playerId as string | undefined) ?? pk.replace(/^PLAYER#/, '');
  if (sk === 'PROFILE') return { pk: gsi3.player, sk: (item.id as string) ?? playerId };
  if (sk.startsWith('PRED#')) return { pk: gsi3.pred, sk: `${playerId}#${item.matchId as string}` };
  if (sk.startsWith('BRK#')) return { pk: gsi3.brk, sk: `${playerId}#${item.matchId as string}` };
  if (sk === 'GBPICK') return { pk: gsi3.gbPick, sk: playerId };
  if (sk === 'DHPICK') return { pk: gsi3.dhPick, sk: playerId };
  if (sk === 'TWPICK') return { pk: gsi3.twPick, sk: playerId };
  if (sk === 'POTTPICK') return { pk: gsi3.pottPick, sk: playerId };
  if (sk.startsWith('PUSH#')) return { pk: gsi3.push, sk: `${playerId}#${item.endpoint as string}` };
  return null;
}

async function main(): Promise<void> {
  const config = loadConfig();
  if (config.persistence !== 'dynamo') throw new Error('backfill-gsi3 requires PERSISTENCE=dynamo');
  const doc = createDynamoDocClient(config);
  const Table = config.tableName;

  let scanned = 0;
  let updated = 0;
  let skipped = 0;
  let ExclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const r = await doc.send(new ScanCommand({ TableName: Table, ExclusiveStartKey }));
    for (const item of (r.Items ?? []) as Item[]) {
      scanned++;
      if (item.GSI3PK !== undefined) { skipped++; continue; } // already backfilled
      const g = gsi3KeysFor(item);
      if (!g) continue; // not a list-all collection
      await doc.send(
        new UpdateCommand({
          TableName: Table,
          Key: { PK: item.PK, SK: item.SK },
          UpdateExpression: 'SET GSI3PK = :pk, GSI3SK = :sk',
          ExpressionAttributeValues: { ':pk': g.pk, ':sk': g.sk },
        }),
      );
      updated++;
    }
    ExclusiveStartKey = r.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (ExclusiveStartKey);

  console.log(`backfill-gsi3 on ${Table}: scanned=${scanned} updated=${updated} alreadyDone=${skipped}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
