// Chat: a global feed and per-group feeds. Polling-based reads; rate-limited writes; admin delete.
import type { MessageRepo, ChatMessage, PlayerRepo } from '../repos/types';
import type { Clock } from '../lib/clock';
import type { GroupService } from './groups';
import type { FeedbackService } from './feedback';
import { AppError, ValidationError } from '../lib/errors';

const MAX_LEN = 500;
const PAGE = 50; // most recent N messages returned
const RATE_LIMIT = 10; // messages / minute / player
const RATE_WINDOW = 60 * 1000;

export interface MessageView {
  id: string;
  playerId: string;
  playerName: string;
  avatarColor: string | null;
  text: string;
  createdAt: string;
}

export interface MessageService {
  listGlobal(): Promise<MessageView[]>;
  postGlobal(callerId: string, text: string): Promise<MessageView>;
  listGroup(callerId: string, groupId: string): Promise<MessageView[]>;
  postGroup(callerId: string, groupId: string, text: string): Promise<MessageView>;
  remove(callerId: string, scope: 'global' | 'group', groupId: string | null, id: string): Promise<void>;
}

const toView = (m: ChatMessage): MessageView => ({
  id: m.id,
  playerId: m.playerId,
  playerName: m.playerName,
  avatarColor: m.avatarColor,
  text: m.text,
  createdAt: m.createdAt,
});

export function createMessageService(
  messages: MessageRepo,
  players: PlayerRepo,
  groups: GroupService,
  feedback: FeedbackService,
  clock: Clock,
): MessageService {
  const hits = new Map<string, number[]>();
  const rateLimit = (playerId: string, now: number): void => {
    const recent = (hits.get(playerId) ?? []).filter((t) => now - t < RATE_WINDOW);
    if (recent.length >= RATE_LIMIT) throw new AppError(429, "You're sending messages too fast — slow down a moment.", 'chat_rate_limited');
    recent.push(now);
    hits.set(playerId, recent);
  };

  const clean = (text: string): string => {
    const t = text.trim();
    if (!t) throw new ValidationError('Message is empty.');
    if (t.length > MAX_LEN) throw new ValidationError(`Message is too long (max ${MAX_LEN} characters).`);
    return t;
  };

  const build = async (callerId: string, scope: 'global' | 'group', groupId: string | null, text: string): Promise<ChatMessage> => {
    const player = await players.getById(callerId);
    const now = clock.now();
    return {
      id: `${now.getTime()}_${Math.random().toString(36).slice(2, 9)}`,
      scope,
      groupId,
      playerId: callerId,
      playerName: player?.name ?? 'Unknown',
      avatarColor: player?.avatarColor ?? null,
      text,
      createdAt: now.toISOString(),
    };
  };

  return {
    async listGlobal() {
      return (await messages.listGlobal(PAGE)).map(toView);
    },
    async postGlobal(callerId, text) {
      const t = clean(text);
      rateLimit(callerId, clock.now().getTime());
      const m = await build(callerId, 'global', null, t);
      await messages.add(m);
      return toView(m);
    },
    async listGroup(callerId, groupId) {
      await groups.assertMember(callerId, groupId);
      return (await messages.listGroup(groupId, PAGE)).map(toView);
    },
    async postGroup(callerId, groupId, text) {
      await groups.assertMember(callerId, groupId);
      const t = clean(text);
      rateLimit(callerId, clock.now().getTime());
      const m = await build(callerId, 'group', groupId, t);
      await messages.add(m);
      return toView(m);
    },
    async remove(callerId, scope, groupId, id) {
      if (!(await feedback.isAdmin(callerId))) throw new AppError(403, 'Only an admin can delete messages.', 'not_admin');
      await messages.remove(scope, groupId, id);
    },
  };
}
