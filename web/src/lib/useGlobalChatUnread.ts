import { useEffect, useReducer } from 'react';
import type { ChatMessage } from '../api/client';
import { CHAT_SEEN_EVENT, hasUnreadGlobalChat } from './chatUnread';

/**
 * Reactive version of `hasUnreadGlobalChat`: recomputes the moment the chat is marked seen
 * — in this tab (via CHAT_SEEN_EVENT) or another tab (via the storage event) — so the unread
 * tick clears immediately on read instead of lingering until the next poll or a refresh.
 */
export function useGlobalChatUnread(
  messages: ChatMessage[] | undefined,
  myPlayerId: string | undefined,
): boolean {
  const [, bump] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    window.addEventListener(CHAT_SEEN_EVENT, bump);
    window.addEventListener('storage', bump); // seen in another tab
    return () => {
      window.removeEventListener(CHAT_SEEN_EVENT, bump);
      window.removeEventListener('storage', bump);
    };
  }, []);
  return hasUnreadGlobalChat(messages, myPlayerId);
}
