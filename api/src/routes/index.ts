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

  // --- Groups ---
  r.post('/groups', auth, validateBody(createGroupSchema), wrap((req) => services.groups.create(caller(req), req.body.name)));
  r.post('/groups/join', auth, joinLimiter, validateBody(joinSchema), wrap((req) => services.groups.join(caller(req), req.body.inviteCode)));
  r.get('/groups', auth, wrap((req) => services.groups.listForPlayer(caller(req))));
  r.get('/groups/:id', auth, wrap((req) => services.groups.get(caller(req), param(req, 'id'))));
  r.delete('/groups/:id', auth, wrapVoid((req) => services.groups.remove(caller(req), param(req, 'id'))));
  r.post('/groups/:id/leave', auth, wrapVoid((req) => services.groups.leave(caller(req), param(req, 'id'))));
  r.get('/groups/:id/members', auth, wrap((req) => services.groups.listMembers(caller(req), param(req, 'id'))));
  r.get('/groups/:id/leaderboard', auth, wrap((req) => services.leaderboard.getLeaderboard(caller(req), param(req, 'id'))));
  r.get('/groups/:id/players/:pid/breakdown', auth, wrap((req) => services.leaderboard.getBreakdown(caller(req), param(req, 'id'), param(req, 'pid'))));
  r.get('/groups/:id/matches/:mid/predictions', auth, wrap((req) => services.predictions.getMatchPredictions(caller(req), param(req, 'id'), param(req, 'mid'))));

  // --- Matches & predictions ---
  r.get('/matches', auth, wrap(() => services.matches.list()));
  r.get('/predictions/me', auth, wrap((req) => services.predictions.getMine(caller(req))));
  r.put('/predictions/:matchId', auth, validateBody(predictionInputSchema), wrap((req) => services.predictions.upsert(caller(req), param(req, 'matchId'), req.body)));
  r.put('/predictions/:matchId/joker', auth, validateBody(jokerSchema), wrap((req) => services.predictions.setJoker(caller(req), param(req, 'matchId'), req.body.joker)));

  // --- Knockout bracket (advancement picks) ---
  r.get('/bracket/me', auth, wrap((req) => services.bracket.getMine(caller(req))));
  r.put('/bracket/:matchId', auth, validateBody(bracketInputSchema), wrap((req) => services.bracket.setPick(caller(req), param(req, 'matchId'), req.body.side)));

  // --- Global leaderboard ---
  r.get('/leaderboard/global', auth, wrap((req) => services.leaderboard.getGlobal(caller(req))));

  return r;
}
