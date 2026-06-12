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

export function makeTestApp(opts: { now?: Date; providerMatches?: Match[] } = {}): TestApp {
  const repos = createMemoryRepositories();
  const clock = opts.now ? fixedClock(opts.now) : systemClock;
  const footballApi: FootballApiClient = {
    fetchCompetitionMatches: async () => opts.providerMatches ?? [],
  };
  const services = createServices({ repos, config: testConfig, clock, logger: silentLogger, footballApi });
  const app = buildApp(services, testConfig, silentLogger);
  return { app, repos, services };
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
