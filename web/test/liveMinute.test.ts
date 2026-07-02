import { describe, it, expect } from 'vitest';
import { liveMinute } from '../src/lib/format';

// Characterization tests for the pure `liveMinute` formatter, proving the behavior that
// `useLiveMinute` relies on to tick: as `now` advances, the kickoff-derived minute advances too.
describe('liveMinute (ticking behavior)', () => {
  const kickoff = '2026-06-15T18:00:00Z';
  const startedAt = '2026-06-15T18:00:00Z';
  const at = (mins: number) => new Date(kickoff).getTime() + mins * 60_000;

  it('is null when the match is not live', () => {
    expect(liveMinute({ status: 'TIMED', kickoff }, at(0))).toBeNull();
    expect(liveMinute({ status: 'SCHEDULED', kickoff }, at(0))).toBeNull();
    expect(liveMinute({ status: 'FINISHED', minute: 90, kickoff }, at(0))).toBeNull();
  });

  it('shows HT while paused, regardless of now', () => {
    expect(liveMinute({ status: 'PAUSED', kickoff, startedAt }, at(50))).toBe('HT');
    expect(liveMinute({ status: 'PAUSED', kickoff, startedAt }, at(65))).toBe('HT');
  });

  it('uses the provider minute (with the U+2032 prime glyph) when present', () => {
    expect(liveMinute({ status: 'IN_PLAY', minute: 23, kickoff, startedAt }, at(23))).toBe('23′');
  });

  it('advances the estimated minute as now advances, proving the ticking source is live', () => {
    const m = { status: 'IN_PLAY' as const, minute: null, kickoff, startedAt };
    const at3_5 = liveMinute(m, Date.parse(startedAt) + 3.5 * 60_000);
    const at10 = liveMinute(m, at(10));
    const at20 = liveMinute(m, at(20));
    expect(at3_5).toBe('3′');
    expect(at10).toBe('10′');
    expect(at20).toBe('20′');
    // Strictly increasing minute values as now increases — this is what ticking depends on.
    expect(Number(at3_5!.replace('′', ''))).toBeLessThan(Number(at10!.replace('′', '')));
    expect(Number(at10!.replace('′', ''))).toBeLessThan(Number(at20!.replace('′', '')));
  });
});
