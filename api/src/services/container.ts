import type { Config } from '../lib/config';
import type { Clock } from '../lib/clock';
import type { Logger } from '../lib/logger';
import type { Repositories } from '../repos/types';
import type { FootballApiClient } from '../integration/footballApiClient';
import { createAuthService, type AuthService } from './auth';
import { createPlayerService, type PlayerService } from './players';
import { createGroupService, type GroupService } from './groups';
import { createMatchService, type MatchService } from './matches';
import { createPredictionService, type PredictionService } from './predictions';
import { createScoringService, type ScoringService } from './scoring';
import { createLeaderboardService, type LeaderboardService } from './leaderboard';
import { createBracketService, type BracketService } from './bracket';
import { createGoldenBootService, type GoldenBootService } from './goldenBoot';
import { createSyncService, type SyncService } from './sync';
import { createEspnClient } from '../integration/espnClient';

export interface Services {
  auth: AuthService;
  players: PlayerService;
  groups: GroupService;
  matches: MatchService;
  predictions: PredictionService;
  scoring: ScoringService;
  leaderboard: LeaderboardService;
  bracket: BracketService;
  goldenBoot: GoldenBootService;
  sync: SyncService;
}

export interface ServiceDeps {
  repos: Repositories;
  config: Config;
  clock: Clock;
  logger: Logger;
  footballApi: FootballApiClient;
}

export function createServices({ repos, config, clock, logger, footballApi }: ServiceDeps): Services {
  const matches = createMatchService(repos.matches, clock);
  const scoring = createScoringService(repos.predictions, repos.matches, repos.bracket);
  const espn = createEspnClient(logger);
  return {
    auth: createAuthService(repos.players, config, clock),
    players: createPlayerService(repos.players),
    groups: createGroupService(repos.groups, repos.memberships, repos.players, clock),
    matches,
    predictions: createPredictionService(repos.predictions, matches, repos.memberships, repos.players, clock),
    scoring,
    leaderboard: createLeaderboardService(repos.predictions, repos.memberships, repos.players, repos.matches, repos.bracket, repos.goldenBoot, clock),
    bracket: createBracketService(repos.bracket, matches, clock),
    goldenBoot: createGoldenBootService(repos.goldenBoot, repos.stats, matches, espn, clock, logger),
    sync: createSyncService(footballApi, repos.matches, scoring, logger),
  };
}
