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

  // Session signing secret must be long enough to resist brute force (LOW: SECURITY-12).
  const sessionSigningSecret = required('SESSION_SIGNING_SECRET');
  if (sessionSigningSecret.length < 32) {
    throw new ConfigError('SESSION_SIGNING_SECRET must be at least 32 characters');
  }

  // SESSION_TTL_DAYS must be a finite, positive number — NaN here would silently break ALL
  // session signing/verification, so fail fast at load (MED).
  const sessionTtlDays = Number(env.SESSION_TTL_DAYS ?? '30');
  if (!Number.isFinite(sessionTtlDays) || sessionTtlDays <= 0) {
    throw new ConfigError(`Invalid SESSION_TTL_DAYS: ${env.SESSION_TTL_DAYS} (must be a positive number)`);
  }

  return {
    tableName: persistence === 'dynamo' ? required('TABLE_NAME') : (env.TABLE_NAME ?? 'wc2026'),
    dynamoEndpoint: env.DYNAMODB_ENDPOINT,
    awsRegion: env.AWS_REGION ?? 'us-east-1',
    // Not required at boot: the read API works on already-synced data; sync surfaces a clear error if missing.
    footballApiToken: env.FOOTBALL_DATA_TOKEN ?? '',
    competition: env.FOOTBALL_COMPETITION ?? 'WC',
    sessionSigningSecret,
    allowedOrigin: required('ALLOWED_ORIGIN'),
    sessionTtlDays,
    persistence,
    adminToken: (env.ADMIN_TOKEN ?? '').trim(),
    // Default empty disables name-based admin entirely — it must be explicitly opted in via
    // ADMIN_PLAYER. A hard-coded default name is registerable/guessable (HIGH).
    adminPlayer: (env.ADMIN_PLAYER ?? '').trim().toLowerCase(),
  };
}
