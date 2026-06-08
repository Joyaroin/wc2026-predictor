import type { Match } from '@wc2026/shared';
import type { Clock } from '../lib/clock';
import type { MatchRepo } from '../repos/types';
import type { MatchView } from './dtos';

export interface MatchService {
  list(): Promise<MatchView[]>;
  get(id: string): Promise<Match | null>;
  isLocked(match: Match): boolean;
}

export function createMatchService(matches: MatchRepo, clock: Clock): MatchService {
  function isLocked(match: Match): boolean {
    return clock.now().getTime() >= new Date(match.kickoff).getTime();
  }
  return {
    isLocked,
    async list() {
      const all = await matches.listAll();
      return all.map((m) => ({ ...m, locked: isLocked(m) }));
    },
    get(id) {
      return matches.getById(id);
    },
  };
}
