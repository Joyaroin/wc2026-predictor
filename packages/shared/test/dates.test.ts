import { describe, it, expect } from 'vitest';
import { weekKey } from '../src/dates';

describe('weekKey', () => {
  it('returns the Monday (UTC) of the week', () => {
    const k = weekKey('2026-06-17T12:00:00Z');
    expect(new Date(`${k}T00:00:00Z`).getUTCDay()).toBe(1); // Monday
  });

  it('groups the same Mon–Sun week together, splits the next week', () => {
    const monday = weekKey('2026-06-17T12:00:00Z');
    const monMs = Date.parse(`${monday}T00:00:00Z`);
    const plus6 = new Date(monMs + 6 * 86400000).toISOString(); // Sunday
    const plus7 = new Date(monMs + 7 * 86400000).toISOString(); // next Monday
    expect(weekKey(plus6)).toBe(monday);
    expect(weekKey(plus7)).not.toBe(monday);
  });
});
