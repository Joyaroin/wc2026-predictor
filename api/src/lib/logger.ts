// Minimal structured JSON logger with secret/PII redaction (SECURITY-03).
// Writes one JSON object per line to stdout; CloudWatch captures it.
type Fields = Record<string, unknown>;

// All entries MUST be lowercase; keys are lower-cased before membership checks so
// redaction is case-insensitive (e.g. 'Authorization' and 'authorization' both match).
const REDACT_KEYS = new Set([
  'pin',
  'pinhash',
  'password',
  'token',
  'authorization',
  'sessionsigningsecret',
  'footballapitoken',
  'apikey',
  'secret',
  'jwt',
  'cookie',
  'set-cookie',
  'bearer',
  'refreshtoken',
  'privatekey',
  'accesskey',
  'footballdatatoken',
  'admintoken',
]);

// Redact a single value, recursing through plain objects AND array elements so a secret
// nested inside an array (e.g. `tokens: [{ token: '...' }]`) is not leaked verbatim.
function redactValue(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(redactValue);
  if (v && typeof v === 'object') return redact(v as Fields);
  return v;
}

function redact(fields: Fields): Fields {
  const out: Fields = {};
  for (const [k, v] of Object.entries(fields)) {
    if (REDACT_KEYS.has(k.toLowerCase())) out[k] = '[REDACTED]';
    else out[k] = redactValue(v);
  }
  return out;
}

export interface Logger {
  info(msg: string, fields?: Fields): void;
  warn(msg: string, fields?: Fields): void;
  error(msg: string, fields?: Fields): void;
  child(bound: Fields): Logger;
}

export function createLogger(base: Fields = {}): Logger {
  const emit = (level: string, msg: string, fields: Fields = {}): void => {
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      level,
      msg,
      ...redact({ ...base, ...fields }),
    });
    // eslint-disable-next-line no-console
    if (level === 'error') console.error(line);
    else console.log(line);
  };
  return {
    info: (msg, fields) => emit('info', msg, fields),
    warn: (msg, fields) => emit('warn', msg, fields),
    error: (msg, fields) => emit('error', msg, fields),
    child: (bound) => createLogger({ ...base, ...bound }),
  };
}
