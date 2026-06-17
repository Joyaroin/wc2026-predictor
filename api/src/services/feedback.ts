// Feedback / bug reports: any logged-in user can submit. The inbox is readable by the owner/admin —
// either the configured admin player (by account name) when logged in, or via the ADMIN_TOKEN header.
import { newId } from '../lib/ids';
import type { Clock } from '../lib/clock';
import type { FeedbackRepo, FeedbackItem, PlayerRepo } from '../repos/types';
import { ForbiddenError, ValidationError } from '../lib/errors';

export const MAX_FEEDBACK_LEN = 2000;

export interface FeedbackService {
  submit(callerId: string, message: string, page?: string): Promise<void>;
  /** Is this caller the owner/admin? (drives whether the web shows the inbox) */
  isAdmin(callerId: string): Promise<boolean>;
  /** Owner/admin only (by account name): list all feedback, newest first. */
  adminList(callerId: string): Promise<FeedbackItem[]>;
  /** Admin-token only: list all feedback (header path). */
  listByToken(token: string | undefined): Promise<FeedbackItem[]>;
}

export function createFeedbackService(
  feedback: FeedbackRepo,
  players: PlayerRepo,
  clock: Clock,
  adminToken: string,
  adminPlayer: string,
  adminPlayerId = '',
): FeedbackService {
  async function isAdmin(callerId: string): Promise<boolean> {
    // When an explicit admin id is configured, only that exact account is admin —
    // a separate account that happens to share the name "adham" does not qualify.
    if (adminPlayerId) return callerId === adminPlayerId;
    if (!adminPlayer) return false;
    const player = await players.getById(callerId);
    return !!player && player.name.trim().toLowerCase() === adminPlayer;
  }

  return {
    async submit(callerId, message, page) {
      const text = message.trim();
      if (!text) throw new ValidationError('Message is required');
      const player = await players.getById(callerId);
      await feedback.add({
        id: newId(),
        playerId: callerId,
        playerName: player?.name ?? 'Unknown',
        message: text.slice(0, MAX_FEEDBACK_LEN),
        page: page?.trim() || null,
        createdAt: clock.now().toISOString(),
      });
    },

    isAdmin,

    async adminList(callerId) {
      if (!(await isAdmin(callerId))) throw new ForbiddenError('Not authorized');
      return feedback.listAll();
    },

    async listByToken(token) {
      if (!adminToken || token !== adminToken) throw new ForbiddenError('Admin token required');
      return feedback.listAll();
    },
  };
}
