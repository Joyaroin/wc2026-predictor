// PBT-02: domain <-> DynamoDB item round-trips.
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  predictionToItem,
  predictionFromItem,
  matchToItem,
  matchFromItem,
  groupToItem,
  groupFromItem,
  playerToItem,
  playerFromItem,
  bracketToItem,
  bracketFromItem,
} from '../../src/repos/mappers';

const arbGoal = fc.integer({ min: 0, max: 30 });
const arbIso = fc.integer({ min: 0, max: 4102444800000 }).map((ms) => new Date(ms).toISOString());

const arbPrediction = fc.record({
  playerId: fc.uuid(),
  matchId: fc.string({ minLength: 1, maxLength: 24 }),
  home: arbGoal,
  away: arbGoal,
  firstTeam: fc.option(fc.constantFrom('HOME', 'AWAY') as fc.Arbitrary<'HOME' | 'AWAY'>, { nil: null }),
  firstScorerId: fc.option(fc.string({ maxLength: 12 }), { nil: null }),
  firstScorerName: fc.option(fc.string({ maxLength: 20 }), { nil: null }),
  points: fc.integer({ min: 0, max: 20 }),
  exact: fc.boolean(),
  joker: fc.boolean(),
  createdAt: arbIso,
  updatedAt: arbIso,
});

const arbMatch = fc.record({
  id: fc.string({ minLength: 1, maxLength: 24 }),
  stage: fc.constantFrom('GROUP_STAGE', 'LAST_32', 'LAST_16', 'QUARTER_FINALS', 'SEMI_FINALS', 'THIRD_PLACE', 'FINAL') as fc.Arbitrary<
    'GROUP_STAGE' | 'LAST_32' | 'LAST_16' | 'QUARTER_FINALS' | 'SEMI_FINALS' | 'THIRD_PLACE' | 'FINAL'
  >,
  groupName: fc.option(fc.string({ minLength: 1, maxLength: 1 }), { nil: null }),
  matchday: fc.option(fc.integer({ min: 1, max: 7 }), { nil: null }),
  homeTeam: fc.string({ minLength: 1, maxLength: 30 }),
  homeCode: fc.option(fc.string({ minLength: 3, maxLength: 3 }), { nil: null }),
  awayTeam: fc.string({ minLength: 1, maxLength: 30 }),
  awayCode: fc.option(fc.string({ minLength: 3, maxLength: 3 }), { nil: null }),
  kickoff: arbIso,
  status: fc.constantFrom('SCHEDULED', 'TIMED', 'IN_PLAY', 'PAUSED', 'FINISHED') as fc.Arbitrary<
    'SCHEDULED' | 'TIMED' | 'IN_PLAY' | 'PAUSED' | 'FINISHED'
  >,
  homeScore: fc.option(arbGoal, { nil: null }),
  awayScore: fc.option(arbGoal, { nil: null }),
  winner: fc.option(fc.constantFrom('HOME', 'AWAY', 'DRAW') as fc.Arbitrary<'HOME' | 'AWAY' | 'DRAW'>, { nil: null }),
  firstGoalTeam: fc.option(fc.constantFrom('HOME', 'AWAY', 'NONE') as fc.Arbitrary<'HOME' | 'AWAY' | 'NONE'>, { nil: null }),
  firstScorerId: fc.option(fc.string({ maxLength: 12 }), { nil: null }),
  firstScorerName: fc.option(fc.string({ maxLength: 20 }), { nil: null }),
  placeholder: fc.boolean(),
});

const arbBracket = fc.record({
  playerId: fc.uuid(),
  matchId: fc.string({ minLength: 1, maxLength: 24 }),
  side: fc.constantFrom('HOME', 'AWAY') as fc.Arbitrary<'HOME' | 'AWAY'>,
  teamName: fc.string({ minLength: 1, maxLength: 30 }),
  points: fc.integer({ min: 0, max: 20 }),
  createdAt: arbIso,
  updatedAt: arbIso,
});

const arbGroup = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 40 }),
  inviteCode: fc.string({ minLength: 8, maxLength: 8 }),
  createdBy: fc.uuid(),
  createdAt: arbIso,
});

const arbPlayer = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 30 }),
  nameKey: fc.string({ minLength: 1, maxLength: 30 }),
  pinHash: fc.string({ minLength: 1, maxLength: 200 }),
  createdAt: arbIso,
  updatedAt: arbIso,
});

describe('mappers round-trip (PBT-02)', () => {
  it('prediction', () => {
    fc.assert(fc.property(arbPrediction, (p) => {
      expect(predictionFromItem(predictionToItem(p))).toEqual(p);
    }));
  });
  it('match', () => {
    fc.assert(fc.property(arbMatch, (m) => {
      expect(matchFromItem(matchToItem(m))).toEqual(m);
    }));
  });
  it('group', () => {
    fc.assert(fc.property(arbGroup, (g) => {
      expect(groupFromItem(groupToItem(g))).toEqual(g);
    }));
  });
  it('player', () => {
    fc.assert(fc.property(arbPlayer, (p) => {
      expect(playerFromItem(playerToItem(p))).toEqual(p);
    }));
  });
  it('bracket pick', () => {
    fc.assert(fc.property(arbBracket, (b) => {
      expect(bracketFromItem(bracketToItem(b))).toEqual(b);
    }));
  });
});
