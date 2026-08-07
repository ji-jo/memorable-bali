import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react(), tailwindcss()],

  server: {
    // 5173 is in use on this machine — see docs/08-Developer-Guide.md.
    // Bind IPv4 explicitly: default localhost can end up on ::1 only, which
    // makes http://127.0.0.1:1234 (and some browser previews) refuse to connect.
    host: '127.0.0.1',
    port: 1234,
    strictPort: true,
  },

  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@data': fileURLToPath(new URL('./data', import.meta.url)),
      // vaul lists style.css in "files" but not "exports" — Vite 6 rejects the bare import.
      'vaul/style.css': fileURLToPath(new URL('./node_modules/vaul/style.css', import.meta.url)),
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
