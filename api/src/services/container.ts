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
import { createMatchStatsService, type MatchStatsService } from './matchStats';
import { createSuggestionsService, type SuggestionsService } from './suggestions';
import { createFlagsService, type FlagsService } from './flags';
import { createPushService, type PushService } from './push';
import { createNotificationsService, type NotificationsService } from './notifications';
import { createSyncService, type SyncService } from './sync';
import { createAssistantService, type AssistantService } from './assistant';
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
  matchStats: MatchStatsService;
  suggestions: SuggestionsService;
  flags: FlagsService;
  push: PushService;
  notifications: NotificationsService;
  sync: SyncService;
  assistant: AssistantService;
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
  const notifications = createNotificationsService(repos.push, repos.predictions, repos.matches, repos.reminders, clock, config, logger);
  const predictions = createPredictionService(repos.predictions, matches, repos.memberships, repos.players, clock);
  const leaderboard = createLeaderboardService(repos.predictions, repos.memberships, repos.players, repos.matches, repos.bracket, repos.goldenBoot, repos.darkHorse, repos.tournamentWinner, repos.pott, clock);
  return {
    auth: createAuthService(repos.players, config, clock),
    players: createPlayerService(repos.players),
    groups: createGroupService(repos.groups, repos.memberships, repos.players, clock),
    matches,
    predictions,
    scoring,
    leaderboard,
    bracket: createBracketService(repos.bracket, matches, clock),
    goldenBoot: createGoldenBootService(repos.goldenBoot, repos.stats, matches, espn, clock, logger),
    darkHorse: createDarkHorseService(repos.darkHorse, matches, clock),
    tournamentWinner: createTournamentWinnerService(repos.tournamentWinner, matches, clock),
    pott: createPottService(repos.pott, repos.stats, matches, clock, config.adminToken),
    feedback: createFeedbackService(repos.feedback, repos.players, clock, config.adminToken, config.adminPlayer, config.adminPlayerId),
    espnFacts: createEspnFactsService(espn, repos.matches, scoring, clock, logger),
    matchStats: createMatchStatsService(espn, repos.matches, clock, logger),
    suggestions: createSuggestionsService(espn, repos.matches, clock, logger),
    flags: createFlagsService(repos.stats),
    push: createPushService(repos.push, config, clock),
    notifications,
    sync: createSyncService(footballApi, repos.matches, scoring, notifications, logger),
    assistant: createAssistantService(config, matches, leaderboard, predictions, clock, logger),
  };
}
