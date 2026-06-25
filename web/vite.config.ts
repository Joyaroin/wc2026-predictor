import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  build: {
    // Split rarely-changing vendor code into its own chunk so it stays cached across
    // app deploys (users only re-download our code, not React on every release).
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('@tanstack')) return 'query-vendor';
          if (id.includes('/react') || id.includes('/scheduler')) return 'react-vendor';
          return undefined;
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
});
