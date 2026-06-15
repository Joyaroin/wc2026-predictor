import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('web-push', () => ({
  default: { setVapidDetails: vi.fn(), sendNotification: vi.fn(() => Promise.resolve()) },
}));
import webpush from 'web-push';

import { createMemoryRepositories } from '../../src/repos/memory';
import { createNotificationsService } from '../../src/services/notifications';
import type { Config } from '../../src/lib/config';
import type { Logger } from '../../src/lib/logger';
import { sampleMatch } from '../support/testApp';

const noopLogger = { info() {}, warn() {}, error() {}, debug() {} } as unknown as Logger;
const config = { vapid: { publicKey: 'pub', privateKey: 'priv', subject: 'mailto:a@b.c' } } as unknown as Config;
const sent = () => (webpush.sendNotification as unknown as { mock: { calls: unknown[][] } }).mock.calls;

beforeEach(() => (webpush.sendNotification as unknown as { mockClear: () => void }).mockClear());

describe('kickoff reminders', () => {
  it('nudges only subscribed non-predictors of an about-to-start match, once', async () => {
    const repos = createMemoryRepositories();
    const now = new Date('2026-06-20T12:00:00.000Z');
    // Match kicks off in 30 min → within the 60-min reminder window.
    await repos.matches.upsert(sampleMatch({ id: 'm1', status: 'SCHEDULED', homeCode: 'BRA', awayCode: 'SUI', kickoff: '2026-06-20T12:30:00.000Z' }));

    const t = now.toISOString();
    await repos.predictions.put({ playerId: 'predictor', matchId: 'm1', home: 1, away: 0, points: 0, createdAt: t, updatedAt: t });
    // Both have push subscriptions; only "predictor" has a pick.
    await repos.push.save({ playerId: 'predictor', endpoint: 'https://push/predictor', keys: { p256dh: 'a', auth: 'b' }, createdAt: t });
    await repos.push.save({ playerId: 'slacker', endpoint: 'https://push/slacker', keys: { p256dh: 'a', auth: 'b' }, createdAt: t });

    const notifications = createNotificationsService(repos.push, repos.predictions, repos.matches, repos.reminders, { now: () => now }, config, noopLogger);

    await notifications.sendKickoffReminders();
    expect(sent()).toHaveLength(1);
    expect((sent()[0]![0] as { endpoint: string }).endpoint).toBe('https://push/slacker');

    // Second run must not re-nudge.
    await notifications.sendKickoffReminders();
    expect(sent()).toHaveLength(1);
  });

  it('does not remind for matches outside the window', async () => {
    const repos = createMemoryRepositories();
    const now = new Date('2026-06-20T12:00:00.000Z');
    await repos.matches.upsert(sampleMatch({ id: 'm2', status: 'SCHEDULED', kickoff: '2026-06-20T18:00:00.000Z' })); // 6h away
    const t = now.toISOString();
    await repos.push.save({ playerId: 'slacker', endpoint: 'https://push/x', keys: { p256dh: 'a', auth: 'b' }, createdAt: t });

    const notifications = createNotificationsService(repos.push, repos.predictions, repos.matches, repos.reminders, { now: () => now }, config, noopLogger);
    await notifications.sendKickoffReminders();
    expect(sent()).toHaveLength(0);
  });
});
