// Minimal structured JSON logger with secret/PII redaction (SECURITY-03).
// Writes one JSON object per line to stdout; CloudWatch captures it.
type Fields = Record<string, unknown>;

const REDACT_KEYS = new Set([
  'pin',
  'pinHash',
  'password',
  'token',
  'authorization',
  'sessionSigningSecret',
  'footballApiToken',
  'apiKey',
]);

function redact(fields: Fields): Fields {
  const out: Fields = {};
  for (const [k, v] of Object.entries(fields)) {
    if (REDACT_KEYS.has(k)) out[k] = '[REDACTED]';
    else if (v && typeof v === 'object' && !Array.isArray(v)) out[k] = redact(v as Fields);
    else out[k] = v;
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
