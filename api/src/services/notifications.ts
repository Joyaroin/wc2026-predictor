// Web Push notifications. Phase 1: alert players who predicted a match on kickoff / goal / full time.
// No-ops when VAPID isn't configured, so the app runs fine without push.
import webpush from 'web-push';
import type { Match, Prediction } from '@wc2026/shared';
import type { PushRepo, PredictionRepo } from '../repos/types';
import type { Config } from '../lib/config';
import type { Logger } from '../lib/logger';

export interface NotificationsService {
  enabled: boolean;
  /** Decide + send any push for a match transition. Never throws. */
  onMatchUpdate(prev: Match | null, next: Match): Promise<void>;
}

interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag: string;
}

function isLive(s: Match['status']): boolean {
  return s === 'IN_PLAY' || s === 'PAUSED';
}

export function createNotificationsService(
  push: PushRepo,
  predictions: PredictionRepo,
  config: Config,
  logger: Logger,
): NotificationsService {
  const enabled = !!config.vapid;
  if (config.vapid) {
    webpush.setVapidDetails(config.vapid.subject, config.vapid.publicKey, config.vapid.privateKey);
  }

  async function sendToPlayer(playerId: string, payload: PushPayload): Promise<void> {
    const subs = await push.listByPlayer(playerId);
    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, JSON.stringify(payload));
        } catch (err) {
          const code = (err as { statusCode?: number }).statusCode;
          if (code === 404 || code === 410) {
            await push.remove(playerId, s.endpoint); // subscription gone — prune it
          } else {
            logger.warn('push send failed', { playerId, code });
          }
        }
      }),
    );
  }

  return {
    enabled,
    async onMatchUpdate(prev, next) {
      if (!enabled) return;
      try {
        const justKicked = isLive(next.status) && (!prev || !isLive(prev.status));
        const justFinished = next.status === 'FINISHED' && (!prev || prev.status !== 'FINISHED');
        const scored =
          isLive(next.status) &&
          !!prev && prev.homeScore != null && next.homeScore != null &&
          (prev.homeScore !== next.homeScore || prev.awayScore !== next.awayScore);

        const kind: 'KICKOFF' | 'GOAL' | 'FT' | null = justFinished ? 'FT' : scored ? 'GOAL' : justKicked ? 'KICKOFF' : null;
        if (!kind) return;

        const preds = await predictions.listByMatch(next.id);
        if (preds.length === 0) return;

        const H = next.homeCode ?? 'Home';
        const A = next.awayCode ?? 'Away';
        const score = `${H} ${next.homeScore ?? 0}–${next.awayScore ?? 0} ${A}`;

        await Promise.all(
          preds.map((p: Prediction) => {
            const pick = `your pick ${p.home}–${p.away}`;
            let title: string;
            let body: string;
            if (kind === 'KICKOFF') {
              title = '🟢 Kick-off';
              body = `${H} v ${A} — ${pick}`;
            } else if (kind === 'GOAL') {
              title = '⚽ Goal!';
              body = `${score} · ${pick}`;
            } else {
              title = '🏁 Full time';
              body = p.points > 0 ? `${score} — you earned +${p.points} pts` : `${score} — ${pick}`;
            }
            return sendToPlayer(p.playerId, { title, body, url: '/fixtures', tag: `${next.id}:${kind}` });
          }),
        );
      } catch (err) {
        logger.warn('notify failed', { matchId: next.id, error: err instanceof Error ? err.message : 'unknown' });
      }
    },
  };
}
