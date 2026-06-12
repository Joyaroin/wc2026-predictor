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
import { createDarkHorseService, type DarkHorseService } from './darkHorse';
import { createTournamentWinnerService, type TournamentWinnerService } from './tournamentWinner';
import { createPottService, type PottService } from './playerOfTournament';
import { createFeedbackService, type FeedbackService } from './feedback';
import { createEspnFactsService, type EspnFactsService } from './espnFacts';
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
  darkHorse: DarkHorseService;
  tournamentWinner: TournamentWinnerService;
  pott: PottService;
  feedback: FeedbackService;
  espnFacts: EspnFactsService;
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
    leaderboard: createLeaderboardService(repos.predictions, repos.memberships, repos.players, repos.matches, repos.bracket, repos.goldenBoot, repos.darkHorse, repos.tournamentWinner, repos.pott, clock),
    bracket: createBracketService(repos.bracket, matches, clock),
    goldenBoot: createGoldenBootService(repos.goldenBoot, repos.stats, matches, espn, clock, logger),
    darkHorse: createDarkHorseService(repos.darkHorse, matches, clock),
    tournamentWinner: createTournamentWinnerService(repos.tournamentWinner, matches, clock),
    pott: createPottService(repos.pott, repos.stats, matches, clock, config.adminToken),
    feedback: createFeedbackService(repos.feedback, repos.players, clock, config.adminToken, config.adminPlayer),
    espnFacts: createEspnFactsService(espn, repos.matches, scoring, clock, logger),
    sync: createSyncService(footballApi, repos.matches, scoring, logger),
  };
}
