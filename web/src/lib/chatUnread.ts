// Tracks the last global-chat message the player has seen, so we can show an
// unread "tick" on the chat entry points and clear it once they open the chat.
import type { ChatMessage } from '../api/client';

const SEEN_KEY = 'wc2026.chat.global.seen';

/** Id of the most recent global message the player has already seen ('' if none). */
export function lastSeenGlobalChat(): string {
  try {
    return localStorage.getItem(SEEN_KEY) ?? '';
  } catch {
    return '';
  }
}

/** Mark the latest global message as seen; returns true if this changed the stored value. */
export function markGlobalChatSeen(latestId: string | undefined | null): boolean {
  if (!latestId || latestId === lastSeenGlobalChat()) return false;
  try {
    localStorage.setItem(SEEN_KEY, latestId);
    return true;
  } catch {
    return false; // ignore storage failures (private mode, quota)
  }
}

/** True when the newest message is unseen and was sent by someone else. */
export function hasUnreadGlobalChat(messages: ChatMessage[] | undefined, myPlayerId: string | undefined): boolean {
  if (!messages || messages.length === 0) return false;
  const latest = messages[messages.length - 1]!;
  if (latest.playerId === myPlayerId) return false; // never tick your own message
  return latest.id !== lastSeenGlobalChat();
}
