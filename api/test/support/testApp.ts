import type { Express } from 'express';
import type { Match } from '@wc2026/shared';
import type { Config } from '../../src/lib/config';
import type { Logger } from '../../src/lib/logger';
import { createMemoryRepositories } from '../../src/repos/memory';
import type { Repositories } from '../../src/repos/types';
import { createServices, type Services } from '../../src/services/container';
import { buildApp } from '../../src/server';
import { fixedClock, systemClock } from '../../src/lib/clock';
import type { FootballApiClient } from '../../src/integration/footballApiClient';
import { hashPin } from '../../src/lib/pin';
import { signSession } from '../../src/lib/token';
import { newId } from '../../src/lib/ids';

const silentLogger: Logger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  child: () => silentLogger,
};

export const testConfig: Config = {
  tableName: 'test',
  dynamoEndpoint: undefined,
  awsRegion: 'us-east-1',
  footballApiToken: 'test-token',
  competition: 'WC',
  sessionSigningSecret: 'test-signing-secret',
  allowedOrigin: '*',
  sessionTtlDays: 30,
  persistence: 'memory',
  adminToken: 'test-admin-token',
  adminPlayer: 'adham',
};

export interface TestApp {
  app: Express;
  repos: Repositories;
  services: Services;
}

export function makeTestApp(
  opts: { now?: Date; providerMatches?: Match[]; config?: Partial<Config> } = {},
): TestApp {
  const repos = createMemoryRepositories();
  const clock = opts.now ? fixedClock(opts.now) : systemClock;
  const footballApi: FootballApiClient = {
    fetchCompetitionMatches: async () => opts.providerMatches ?? [],
  };
  const config: Config = { ...testConfig, ...opts.config };
  const services = createServices({ repos, config, clock, logger: silentLogger, footballApi });
  const app = buildApp(services, config, silentLogger);
  return { app, repos, services };
}

/**
 * Seeds a player record directly into the repo and returns a valid session token.
 * Needed for the admin account, which can no longer be created via the public signup path
 * (a configured admin name is reserved — see auth.login).
 */
export async function seedPlayer(
  repos: Repositories,
  name: string,
  pin: string,
): Promise<{ playerId: string; token: string }> {
  const id = newId();
  const now = new Date().toISOString();
  await repos.players.create({
    id,
    name,
    nameKey: name.trim().toLowerCase(),
    pinHash: await hashPin(pin),
    createdAt: now,
    updatedAt: now,
  });
  return { playerId: id, token: signSession(id, testConfig.sessionSigningSecret, testConfig.sessionTtlDays) };
}

export function sampleMatch(over: Partial<Match> = {}): Match {
  return {
    id: 'm1',
    stage: 'GROUP_STAGE',
    groupName: 'A',
    matchday: 1,
    homeTeam: 'Brazil',
    homeCode: 'BRA',
    awayTeam: 'Argentina',
    awayCode: 'ARG',
    kickoff: '2026-06-15T18:00:00.000Z',
    status: 'SCHEDULED',
    homeScore: null,
    awayScore: null,
    placeholder: false,
    ...over,
  };
}
