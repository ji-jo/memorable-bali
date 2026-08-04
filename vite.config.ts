import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],

  server: {
    // 5173 is in use on this machine — see docs/08-Developer-Guide.md.
    // This port must match the localhost entry on the Google Maps key's
    // Websites restriction, or the map will refuse to load in dev.
    port: 1234,
    strictPort: true,
  },

  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@data': fileURLToPath(new URL('./data', import.meta.url)),
    },
  },

  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Keep the router out of the entry chunk so first paint stays small.
          router: ['react-router-dom'],
        },
      },
    },
  },

  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
  },
});
