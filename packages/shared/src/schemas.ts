// Runtime validation schemas (zod) — reused by `api` for input validation (SECURITY-05 / BR-4).
import { z } from 'zod';

/** BR-4.1 — goals: integer in [0, 30]. */
export const goalSchema = z.number().int().min(0).max(30);

export const scoreSchema = z.object({
  home: goalSchema,
  away: goalSchema,
});

/** BR-4.2 — player display name. */
export const playerNameSchema = z.string().trim().min(1).max(30);

/** BR-4.3 — group name. */
export const groupNameSchema = z.string().trim().min(1).max(40);

/** BR-4.4 — invite code: 8 chars base32 excluding ambiguous 0/O/1/I. */
export const inviteCodeSchema = z
  .string()
  .trim()
  .transform((s) => s.toUpperCase())
  .pipe(z.string().regex(/^[A-Z2-9]{8}$/, 'Invalid invite code'));

export const stageSchema = z.enum([
  'GROUP_STAGE',
  'LAST_32',
  'LAST_16',
  'QUARTER_FINALS',
  'SEMI_FINALS',
  'THIRD_PLACE',
  'FINAL',
]);

export const matchStatusSchema = z.enum([
  'SCHEDULED',
  'TIMED',
  'IN_PLAY',
  'PAUSED',
  'FINISHED',
]);

export const outcomeSchema = z.enum(['HOME', 'DRAW', 'AWAY']);
export const bracketSideSchema = z.enum(['HOME', 'AWAY']);
export const bracketInputSchema = z.object({ side: bracketSideSchema });

// Per-prediction points: scoreline (max 12) + first team to score (+2) + first player to score (+6) = max 20.
export const pointsSchema = z.number().int().min(0).max(20);

/** Request body when a player submits/updates a prediction. */
export const predictionInputSchema = z.object({
  home: goalSchema,
  away: goalSchema,
  firstTeam: bracketSideSchema.nullable().optional(),
  firstScorerId: z.string().max(40).nullable().optional(),
  firstScorerName: z.string().max(80).nullable().optional(),
});

/** Full persisted prediction shape (used for serialization round-trip — PBT-02). */
export const predictionSchema = z.object({
  playerId: z.string().min(1),
  matchId: z.string().min(1),
  home: goalSchema,
  away: goalSchema,
  firstTeam: bracketSideSchema.nullable().optional(),
  firstScorerId: z.string().nullable().optional(),
  firstScorerName: z.string().nullable().optional(),
  points: pointsSchema,
  exact: z.boolean().optional(),
  joker: z.boolean().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const matchSchema = z.object({
  id: z.string().min(1),
  stage: stageSchema,
  groupName: z.string().nullable(),
  matchday: z.number().int().nullable(),
  homeTeam: z.string(),
  homeCode: z.string().nullable(),
  awayTeam: z.string(),
  awayCode: z.string().nullable(),
  kickoff: z.string(),
  status: matchStatusSchema,
  homeScore: goalSchema.nullable(),
  awayScore: goalSchema.nullable(),
  winner: outcomeSchema.nullable().optional(),
  firstGoalTeam: z.enum(['HOME', 'AWAY', 'NONE']).nullable().optional(),
  firstScorerId: z.string().nullable().optional(),
  firstScorerName: z.string().nullable().optional(),
  placeholder: z.boolean(),
});

export const bracketPickSchema = z.object({
  playerId: z.string().min(1),
  matchId: z.string().min(1),
  side: bracketSideSchema,
  teamName: z.string(),
  points: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const createGroupSchema = z.object({ name: groupNameSchema });
export const joinGroupSchema = z.object({ inviteCode: inviteCodeSchema });
export const createPlayerSchema = z.object({ name: playerNameSchema });
export const renamePlayerSchema = z.object({ name: playerNameSchema });
