// Serialization round-trip properties (PBT-02): parse(serialize(x)) === x.
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { predictionSchema, matchSchema } from '../src/schemas';

const arbGoal = fc.integer({ min: 0, max: 30 });
const arbIso = fc
  .integer({ min: 0, max: 4102444800000 }) // 1970 .. 2100
  .map((ms) => new Date(ms).toISOString());

const arbPrediction = fc.record({
  playerId: fc.uuid(),
  matchId: fc.string({ minLength: 1, maxLength: 24 }),
  home: arbGoal,
  away: arbGoal,
  points: fc.constantFrom(0, 2, 3, 5),
  joker: fc.boolean(),
  createdAt: arbIso,
  updatedAt: arbIso,
});

const arbMatch = fc.record({
  id: fc.string({ minLength: 1, maxLength: 24 }),
  stage: fc.constantFrom(
    'GROUP_STAGE',
    'LAST_32',
    'LAST_16',
    'QUARTER_FINALS',
    'SEMI_FINALS',
    'THIRD_PLACE',
    'FINAL',
  ),
  groupName: fc.option(fc.string({ minLength: 1, maxLength: 1 }), { nil: null }),
  matchday: fc.option(fc.integer({ min: 1, max: 7 }), { nil: null }),
  homeTeam: fc.string({ minLength: 1, maxLength: 30 }),
  homeCode: fc.option(fc.string({ minLength: 3, maxLength: 3 }), { nil: null }),
  awayTeam: fc.string({ minLength: 1, maxLength: 30 }),
  awayCode: fc.option(fc.string({ minLength: 3, maxLength: 3 }), { nil: null }),
  kickoff: arbIso,
  status: fc.constantFrom('SCHEDULED', 'TIMED', 'IN_PLAY', 'PAUSED', 'FINISHED'),
  homeScore: fc.option(arbGoal, { nil: null }),
  awayScore: fc.option(arbGoal, { nil: null }),
  placeholder: fc.boolean(),
});

describe('schema round-trips (RT-1)', () => {
  it('prediction survives JSON serialize → parse', () => {
    fc.assert(
      fc.property(arbPrediction, (p) => {
        const back = predictionSchema.parse(JSON.parse(JSON.stringify(p)));
        expect(back).toEqual(p);
      }),
    );
  });

  it('match survives JSON serialize → parse', () => {
    fc.assert(
      fc.property(arbMatch, (m) => {
        const back = matchSchema.parse(JSON.parse(JSON.stringify(m)));
        expect(back).toEqual(m);
      }),
    );
  });
});
