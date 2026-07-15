// Configuration loader — validates required env at startup (fail fast — US-7.2 / SECURITY-12).
export interface Config {
  tableName: string;
  dynamoEndpoint: string | undefined;
  awsRegion: string;
  footballApiToken: string;
  competition: string;
  sessionSigningSecret: string;
  allowedOrigin: string;
  sessionTtlDays: number;
  persistence: 'dynamo' | 'memory';
  /**
   * When true, list-all reads Query the GSI3 type index instead of scanning the whole table.
   * Defaults false so a deploy is behavior-neutral: only flip to true after the table has the
   * GSI3 index (terraform apply) AND existing items have been backfilled (scripts/backfill-gsi3.ts),
   * otherwise those queries return only items written since the change. See infra/README / docs.
   */
  useGsiLists: boolean;
  /** Token gating admin actions (e.g. setting Player of the Tournament). Empty = admin disabled. */
  adminToken: string;
  /** Player name (lower-cased) treated as the owner/admin — sees the feedback inbox when logged in. */
  adminPlayer: string;
  /** Exact player id of the admin account. When set, admin is locked to this id (not just the name). */
  adminPlayerId: string;
  /** Web Push (VAPID) keys. Null when not configured — push notifications are then disabled. */
  vapid: { publicKey: string; privateKey: string; subject: string } | null;
  /** Anthropic API key for the in-app assistant. Empty = assistant disabled (graceful no-op). */
  anthropicApiKey: string;
  /** Model id for the assistant. */
  assistantModel: string;
  /** Model id used only when the user opts into web research (kept cheap by default). */
  assistantResearchModel: string;
}

export class ConfigError extends Error {}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const required = (key: string): string => {
    const v = env[key];
    if (v === undefined || v.trim() === '') {
      throw new ConfigError(`Missing required environment variable: ${key}`);
    }
    return v;
  };

  const persistence = env.PERSISTENCE === 'memory' ? 'memory' : 'dynamo';

  return {
    tableName: persistence === 'dynamo' ? required('TABLE_NAME') : (env.TABLE_NAME ?? 'wc2026'),
    dynamoEndpoint: env.DYNAMODB_ENDPOINT,
    awsRegion: env.AWS_REGION ?? 'us-east-1',
    // Not required at boot: the read API works on already-synced data; sync surfaces a clear error if missing.
    footballApiToken: env.FOOTBALL_DATA_TOKEN ?? '',
    competition: env.FOOTBALL_COMPETITION ?? 'WC',
    sessionSigningSecret: required('SESSION_SIGNING_SECRET'),
    allowedOrigin: required('ALLOWED_ORIGIN'),
    sessionTtlDays: Number(env.SESSION_TTL_DAYS ?? '30'),
    persistence,
    useGsiLists: env.USE_GSI_LISTS === 'true',
    adminToken: (env.ADMIN_TOKEN ?? '').trim(),
    adminPlayer: (env.ADMIN_PLAYER ?? 'adham').trim().toLowerCase(),
    adminPlayerId: (env.ADMIN_PLAYER_ID ?? '').trim(),
    vapid:
      env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY
        ? {
            publicKey: env.VAPID_PUBLIC_KEY.trim(),
            privateKey: env.VAPID_PRIVATE_KEY.trim(),
            subject: (env.VAPID_SUBJECT ?? 'mailto:notifications@wc-predictions-2026.com').trim(),
          }
        : null,
    anthropicApiKey: (env.ANTHROPIC_API_KEY ?? '').trim(),
    assistantModel: (env.ASSISTANT_MODEL ?? 'claude-haiku-4-5').trim(),
    assistantResearchModel: (env.ASSISTANT_RESEARCH_MODEL ?? 'claude-haiku-4-5').trim(),
  };
}
