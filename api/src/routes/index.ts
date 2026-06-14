import { Router, type Request, type RequestHandler } from 'express';
import { z } from 'zod';
import {
  playerNameSchema,
  groupNameSchema,
  inviteCodeSchema,
  predictionInputSchema,
  bracketInputSchema,
} from '@wc2026/shared';
import type { Config } from '../lib/config';
import type { Services } from '../services/container';
import { ForbiddenError } from '../lib/errors';
import {
  requireSession,
  validateBody,
  loginLimiter,
  joinLimiter,
} from '../middleware/index';

const wrapVoid =
  (fn: (req: Request) => Promise<void>): RequestHandler =>
  (req, res, next) => {
    fn(req)
      .then(() => res.json({ ok: true }))
      .catch(next);
  };

const loginSchema = z.object({
  name: playerNameSchema,
  pin: z.string().regex(/^\d{4}$/, 'PIN must be 4 digits'),
});
const renameSchema = z.object({ name: playerNameSchema });
const pinSchema = z.string().regex(/^\d{4}$/, 'PIN must be 4 digits');
const changePinSchema = z.object({ currentPin: pinSchema, newPin: pinSchema });
const createGroupSchema = z.object({ name: groupNameSchema });
const joinSchema = z.object({ inviteCode: inviteCodeSchema });
const jokerSchema = z.object({ joker: z.boolean() });
const goldenBootSchema = z.object({ scorerId: z.string().min(1).max(40), scorerName: z.string().min(1).max(80) });
const darkHorseSchema = z.object({ teamCode: z.string().min(2).max(4), teamName: z.string().min(1).max(60) });
const pottSchema = z.object({ winnerId: z.string().min(1).max(40), winnerName: z.string().min(1).max(80) });
const feedbackSchema = z.object({ message: z.string().min(1).max(2000), page: z.string().max(120).optional() });

const wrap =
  (fn: (req: Request) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req)
      .then((data) => res.json(data))
      .catch(next);
  };

const caller = (req: Request): string => req.callerId as string;
const param = (req: Request, key: string): string => {
  const v = req.params[key];
  return typeof v === 'string' ? v : '';
};

export function buildRouter(services: Services, config: Config): Router {
  const r = Router();
  const auth = requireSession(config);

  // --- Auth (public, rate-limited) ---
  r.post('/auth/login', loginLimiter, validateBody(loginSchema), wrap((req) => services.auth.login(req.body.name, req.body.pin)));

  // --- Players ---
  r.get('/players/me', auth, wrap((req) => services.players.getMe(caller(req))));
  r.post('/players/me/name', auth, validateBody(renameSchema), wrap((req) => services.players.rename(caller(req), req.body.name)));
  r.post('/players/me/pin', auth, loginLimiter, validateBody(changePinSchema), wrapVoid((req) => services.players.changePin(caller(req), req.body.currentPin, req.body.newPin)));
  r.post('/players/me/tour-seen', auth, wrapVoid((req) => services.players.markTourSeen(caller(req))));

  // --- Groups ---
  r.post('/groups', auth, validateBody(createGroupSchema), wrap((req) => services.groups.create(caller(req), req.body.name)));
  r.post('/groups/join', auth, joinLimiter, validateBody(joinSchema), wrap((req) => services.groups.join(caller(req), req.body.inviteCode)));
  r.get('/groups', auth, wrap((req) => services.groups.listForPlayer(caller(req))));
  r.get('/groups/:id', auth, wrap((req) => services.groups.get(caller(req), param(req, 'id'))));
  r.delete('/groups/:id', auth, wrapVoid((req) => services.groups.remove(caller(req), param(req, 'id'))));
  r.post('/groups/:id/leave', auth, wrapVoid((req) => services.groups.leave(caller(req), param(req, 'id'))));
  r.get('/groups/:id/members', auth, wrap((req) => services.groups.listMembers(caller(req), param(req, 'id'))));
  r.get('/groups/:id/leaderboard', auth, wrap((req) => services.leaderboard.getLeaderboard(caller(req), param(req, 'id'), req.query.scope === 'week' ? 'week' : undefined)));
  r.get('/groups/:id/players/:pid/breakdown', auth, wrap((req) => services.leaderboard.getBreakdown(caller(req), param(req, 'id'), param(req, 'pid'))));
  r.get('/groups/:id/matches/:mid/predictions', auth, wrap((req) => services.predictions.getMatchPredictions(caller(req), param(req, 'id'), param(req, 'mid'))));

  // --- Matches & predictions ---
  r.get('/matches', auth, wrap(() => services.matches.list()));
  r.get('/matches/:id/stats', auth, wrap((req) => services.matchStats.get(param(req, 'id'))));
  r.get('/predictions/me', auth, wrap((req) => services.predictions.getMine(caller(req))));
  r.put('/predictions/:matchId', auth, validateBody(predictionInputSchema), wrap((req) => services.predictions.upsert(caller(req), param(req, 'matchId'), req.body)));
  r.put('/predictions/:matchId/joker', auth, validateBody(jokerSchema), wrap((req) => services.predictions.setJoker(caller(req), param(req, 'matchId'), req.body.joker)));
  r.delete('/predictions/:matchId', auth, wrapVoid((req) => services.predictions.remove(caller(req), param(req, 'matchId'))));

  // --- Knockout bracket (advancement picks) ---
  r.get('/bracket/me', auth, wrap((req) => services.bracket.getMine(caller(req))));
  r.put('/bracket/:matchId', auth, validateBody(bracketInputSchema), wrap((req) => services.bracket.setPick(caller(req), param(req, 'matchId'), req.body.side)));

  // --- Golden Boot / Player of the Tournament ---
  r.get('/players/pool', auth, wrap(() => services.goldenBoot.getPlayerPool()));
  r.get('/golden-boot', auth, wrap((req) => services.goldenBoot.getStatus(caller(req))));
  r.put('/golden-boot', auth, validateBody(goldenBootSchema), wrap((req) => services.goldenBoot.setPick(caller(req), req.body.scorerId, req.body.scorerName)));
  r.get('/dark-horse', auth, wrap((req) => services.darkHorse.getStatus(caller(req))));
  r.put('/dark-horse', auth, validateBody(darkHorseSchema), wrap((req) => services.darkHorse.setPick(caller(req), req.body.teamCode, req.body.teamName)));
  r.get('/tournament-winner', auth, wrap((req) => services.tournamentWinner.getStatus(caller(req))));
  r.put('/tournament-winner', auth, validateBody(darkHorseSchema), wrap((req) => services.tournamentWinner.setPick(caller(req), req.body.teamCode, req.body.teamName)));
  r.get('/player-of-tournament', auth, wrap((req) => services.pott.getStatus(caller(req))));
  r.put('/player-of-tournament', auth, validateBody(pottSchema), wrap((req) => services.pott.setPick(caller(req), req.body.winnerId, req.body.winnerName)));
  // Admin-only (X-Admin-Token header): set the official Player of the Tournament winner.
  r.post('/admin/player-of-tournament', validateBody(pottSchema), wrap((req) => services.pott.setWinner(req.header('x-admin-token'), req.body.winnerId, req.body.winnerName)));

  // --- Feedback / bug reports ---
  r.post('/feedback', auth, validateBody(feedbackSchema), wrapVoid((req) => services.feedback.submit(caller(req), req.body.message, req.body.page)));
  r.get('/feedback/admin/me', auth, wrap(async (req) => ({ isAdmin: await services.feedback.isAdmin(caller(req)) })));
  // Owner/admin (logged-in as the admin account) reads submitted feedback.
  r.get('/feedback/admin', auth, wrap((req) => services.feedback.adminList(caller(req))));
  // Fallback: read via X-Admin-Token header.
  r.get('/admin/feedback', wrap((req) => services.feedback.listByToken(req.header('x-admin-token'))));
  // Owner/admin: re-score every finished match (e.g. after a scoring-rule change).
  r.post('/admin/rescore', auth, wrap(async (req) => {
    if (!(await services.feedback.isAdmin(caller(req)))) throw new ForbiddenError('Not authorized');
    return { rescored: await services.scoring.rescoreAll() };
  }));

  // --- Global leaderboard ---
  r.get('/leaderboard/global', auth, wrap((req) => services.leaderboard.getGlobal(caller(req))));
  r.get('/players/:pid/breakdown', auth, wrap((req) => services.leaderboard.getPlayerBreakdown(caller(req), param(req, 'pid'))));

  return r;
}
