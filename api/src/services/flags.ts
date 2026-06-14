// Runtime feature flags (admin-toggleable). Currently just controls the pop-up ads.
import type { StatsRepo, AppFlags } from '../repos/types';

export interface FlagsService {
  get(): Promise<AppFlags>;
  set(patch: Partial<AppFlags>): Promise<AppFlags>;
}

export function createFlagsService(stats: StatsRepo): FlagsService {
  return {
    get: () => stats.getFlags(),
    set: (patch) => stats.setFlags(patch),
  };
}
