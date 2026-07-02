import { createHash } from 'node:crypto';
import type { Clock } from './clock';
import type { MatchView } from '../services/dtos';

export interface MatchesCache {
  get(loader: () => Promise<MatchView[]>): Promise<{ body: MatchView[]; etag: string }>;
}

// Collapses concurrent /matches reads to one Dynamo call within ttlMs, and derives a
// stable content ETag so unchanged responses can 304.
export function createMatchesCache(ttlMs: number, clock: Clock): MatchesCache {
  let hit: { at: number; body: MatchView[]; etag: string } | null = null;
  let inflight: Promise<{ body: MatchView[]; etag: string }> | null = null;

  return {
    async get(loader) {
      const now = clock.now().getTime();
      if (hit && now - hit.at < ttlMs) return { body: hit.body, etag: hit.etag };
      if (inflight) return inflight;
      inflight = (async () => {
        const body = await loader();
        const etag = `"${createHash('sha1').update(JSON.stringify(body)).digest('hex')}"`;
        hit = { at: clock.now().getTime(), body, etag };
        return { body, etag };
      })();
      try {
        return await inflight;
      } finally {
        inflight = null;
      }
    },
  };
}
