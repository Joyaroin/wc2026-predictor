// Web Push subscription management (store/remove a browser subscription; expose the VAPID public key).
import type { PushRepo } from '../repos/types';
import type { Config } from '../lib/config';
import type { Clock } from '../lib/clock';

export interface BrowserSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface PushService {
  /** VAPID public key for the client to subscribe, or null when push is disabled. */
  publicKey(): string | null;
  subscribe(playerId: string, sub: BrowserSubscription): Promise<void>;
  unsubscribe(playerId: string, endpoint: string): Promise<void>;
}

export function createPushService(push: PushRepo, config: Config, clock: Clock): PushService {
  return {
    publicKey: () => config.vapid?.publicKey ?? null,
    subscribe: (playerId, sub) =>
      push.save({ playerId, endpoint: sub.endpoint, keys: sub.keys, createdAt: clock.now().toISOString() }),
    unsubscribe: (playerId, endpoint) => push.remove(playerId, endpoint),
  };
}
