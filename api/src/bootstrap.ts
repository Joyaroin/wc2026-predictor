// Composition root: load config, pick repositories, wire services + app.
import type { Express } from 'express';
import { loadConfig, type Config } from './lib/config';
import { createLogger, type Logger } from './lib/logger';
import { systemClock } from './lib/clock';
import type { Repositories } from './repos/types';
import { createMemoryRepositories } from './repos/memory';
import { createDynamoRepositories } from './repos/dynamo';
import { createFootballApiClient } from './integration/footballApiClient';
import { createServices, type Services } from './services/container';
import { buildApp } from './server';

export interface Container {
  app: Express;
  services: Services;
  config: Config;
  logger: Logger;
}

export function composeFromEnv(): Container {
  const config = loadConfig();
  const logger = createLogger({ app: 'wc2026-api' });
  const repos: Repositories =
    config.persistence === 'memory' ? createMemoryRepositories() : createDynamoRepositories(config);
  const footballApi = createFootballApiClient(config, logger);
  const services = createServices({ repos, config, clock: systemClock, logger, footballApi });
  const app = buildApp(services, config, logger);
  return { app, services, config, logger };
}
