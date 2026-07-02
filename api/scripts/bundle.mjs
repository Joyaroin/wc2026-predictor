// Bundle the server + sync entrypoints into self-contained CJS files for the container image.
import { build } from 'esbuild';

const common = {
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  sourcemap: false,
  logLevel: 'info',
};

await build({ ...common, entryPoints: ['src/app.ts'], outfile: 'dist/server.cjs' });
await build({ ...common, entryPoints: ['src/sync.run.ts'], outfile: 'dist/sync.cjs' });
await build({ ...common, entryPoints: ['src/sync.live.ts'], outfile: 'dist/sync-live.cjs' });

console.log('Bundled dist/server.cjs, dist/sync.cjs and dist/sync-live.cjs');
