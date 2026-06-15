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
  /** Token gating admin actions (e.g. setting Player of the Tournament). Empty = admin disabled. */
  adminToken: string;
  /** Player name (lower-cased) treated as the owner/admin — sees the feedback inbox when logged in. */
  adminPlayer: string;
  /** Web Push (VAPID) keys. Null when not configured — push notifications are then disabled. */
  vapid: { publicKey: string; privateKey: string; subject: string } | null;
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
    adminToken: (env.ADMIN_TOKEN ?? '').trim(),
    adminPlayer: (env.ADMIN_PLAYER ?? 'adham').trim().toLowerCase(),
    vapid:
      env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY
        ? {
            publicKey: env.VAPID_PUBLIC_KEY.trim(),
            privateKey: env.VAPID_PRIVATE_KEY.trim(),
            subject: (env.VAPID_SUBJECT ?? 'mailto:notifications@wc-predictions-2026.com').trim(),
          }
        : null,
  };
}
