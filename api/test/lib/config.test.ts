import { describe, it, expect } from 'vitest';
import { loadConfig, ConfigError } from '../../src/lib/config';

// A minimal valid env (memory persistence so TABLE_NAME isn't required).
const baseEnv = (over: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv => ({
  PERSISTENCE: 'memory',
  SESSION_SIGNING_SECRET: 'x'.repeat(32),
  ALLOWED_ORIGIN: 'https://example.test',
  ...over,
});

describe('loadConfig (US-7.2 / SECURITY-12)', () => {
  it('loads with valid env and defaults SESSION_TTL_DAYS to 30', () => {
    const cfg = loadConfig(baseEnv());
    expect(cfg.sessionTtlDays).toBe(30);
  });

  it('rejects a NaN SESSION_TTL_DAYS at load (fail fast — would otherwise break all auth)', () => {
    expect(() => loadConfig(baseEnv({ SESSION_TTL_DAYS: 'abc' }))).toThrow(ConfigError);
  });

  it('rejects a non-positive SESSION_TTL_DAYS at load', () => {
    expect(() => loadConfig(baseEnv({ SESSION_TTL_DAYS: '0' }))).toThrow(ConfigError);
    expect(() => loadConfig(baseEnv({ SESSION_TTL_DAYS: '-5' }))).toThrow(ConfigError);
  });

  it('accepts an explicit positive SESSION_TTL_DAYS', () => {
    expect(loadConfig(baseEnv({ SESSION_TTL_DAYS: '7' })).sessionTtlDays).toBe(7);
  });

  it("defaults adminPlayer to '' (name-based admin disabled unless ADMIN_PLAYER is set)", () => {
    expect(loadConfig(baseEnv()).adminPlayer).toBe('');
  });

  it('lower-cases and trims an explicit ADMIN_PLAYER', () => {
    expect(loadConfig(baseEnv({ ADMIN_PLAYER: '  Adham  ' })).adminPlayer).toBe('adham');
  });

  it('rejects a SESSION_SIGNING_SECRET shorter than 32 chars', () => {
    expect(() => loadConfig(baseEnv({ SESSION_SIGNING_SECRET: 'short' }))).toThrow(ConfigError);
  });

  it('requires SESSION_SIGNING_SECRET and ALLOWED_ORIGIN', () => {
    expect(() => loadConfig(baseEnv({ SESSION_SIGNING_SECRET: undefined }))).toThrow(ConfigError);
    expect(() => loadConfig(baseEnv({ ALLOWED_ORIGIN: undefined }))).toThrow(ConfigError);
  });
});
