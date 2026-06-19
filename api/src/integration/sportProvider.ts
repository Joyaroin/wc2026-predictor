// ─────────────────────────────────────────────────────────────────────────────
// SKETCH (non-wired) — Multi-sport data layer.
//
// This file is an ADDITIVE proposal: it introduces a sport-neutral `SportProvider`
// abstraction without changing any existing behaviour. Nothing imports it yet.
// `footballApiClient.ts`, `sync.ts`, and `bootstrap.ts` are untouched.
//
// The point it proves: the existing `FootballApiClient` is already shaped like a
// generic provider (`fetchCompetitionMatches(): Promise<Match[]>` + a pure
// `mapToDomain` translator). Promoting that seam to `SportProvider` is what lets
// the prediction/scoring/leaderboard/assistant core serve tennis/NBA/NHL/MLB/NFL.
//
// See aidlc-docs/multi-sport-refactor.md for the full migration plan.
// ─────────────────────────────────────────────────────────────────────────────
import type { Match } from '@wc2026/shared';
import type { Config } from '../lib/config';
import type { Logger } from '../lib/logger';
import { createFootballApiClient } from './footballApiClient';

/** Sports the platform can target. Extend as adapters are added. */
export type Sport = 'football' | 'basketball' | 'hockey' | 'baseball' | 'american-football' | 'tennis';

/**
 * The one interface the rest of the app depends on. Identical surface to today's
 * `FootballApiClient`, just renamed sport-neutrally. `fetchMatches()` returns the
 * domain `Match[]` — each adapter owns its own `mapToDomain` translator
 * (the anti-corruption layer), so provider quirks never leak past this boundary.
 */
export interface SportProvider {
  readonly sport: Sport;
  readonly providerId: string; // e.g. 'football-data.org', 'thesportsdb', 'balldontlie'
  fetchMatches(): Promise<Match[]>;
}

/** A constructor for a provider, given runtime config + logger (matches today's DI style). */
export type SportProviderFactory = (config: Config, logger: Logger) => SportProvider;

// ── Adapter 1: football-data.org ─────────────────────────────────────────────
// Wraps the EXISTING client unchanged — proves the migration is a rename, not a
// rewrite. `sync.ts` could depend on `SportProvider` and get this for free.
export const footballDataProvider: SportProviderFactory = (config, logger) => {
  const client = createFootballApiClient(config, logger);
  return {
    sport: 'football',
    providerId: 'football-data.org',
    fetchMatches: () => client.fetchCompetitionMatches(),
  };
};

// ── Adapter 2+: stubs to fill in (see src-free-sports-apis-2026 research) ─────
// Each new adapter = (a) fetch the provider's REST endpoint, (b) a pure
// `mapToDomain(providerMatch): Match` translator. No other file changes.
//
//   theSportsDbProvider   → best FREE multi-sport (~30 req/min, many sports)
//   balldontlieProvider   → 20+ leagues; free tier is ONE sport only
//   espnProvider          → free + broad, but UNOFFICIAL (use as fallback)
//
// export const theSportsDbProvider: SportProviderFactory = (config, logger) => { ... };

// ── Registry / factory ───────────────────────────────────────────────────────
// `bootstrap.ts` would select an adapter from config (e.g. SPORT + DATA_PROVIDER
// env vars) instead of hard-calling `createFootballApiClient`.
const REGISTRY: Record<string, SportProviderFactory> = {
  'football:football-data.org': footballDataProvider,
  // 'basketball:thesportsdb': theSportsDbProvider,
  // 'tennis:matchstat': matchstatProvider,
};

export function resolveSportProvider(
  sport: Sport,
  providerId: string,
  config: Config,
  logger: Logger,
): SportProvider {
  const factory = REGISTRY[`${sport}:${providerId}`];
  if (!factory) {
    throw new Error(`No SportProvider registered for ${sport}:${providerId}`);
  }
  return factory(config, logger);
}
