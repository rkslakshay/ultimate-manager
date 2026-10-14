import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  // Single .env at the repo root.
  const env = loadEnv(mode, path.resolve(here, '../..'), '');
  const apiTarget = `http://${env.API_HOST ?? '127.0.0.1'}:${env.API_PORT ?? 4000}`;

  return {
    plugins: [react(), tailwindcss()],
    // Pre-bundle deps only used on some routes, so the dev server doesn't re-optimise and
    // reload the page the first time such a route is opened (which also breaks E2E runs).
    optimizeDeps: { include: ['recharts'] },
    resolve: {
      alias: { '@': path.resolve(here, 'src') },
    },
    server: {
      port: Number(env.WEB_PORT ?? 5173),
      strictPort: true,
      proxy: { '/api': { target: apiTarget, changeOrigin: false } },
    },
    preview: {
      port: Number(env.WEB_PORT ?? 5173),
      proxy: { '/api': { target: apiTarget, changeOrigin: false } },
    },
    test: {
      environment: 'jsdom',
      include: ['src/**/*.test.{ts,tsx}'],
      setupFiles: ['./src/test/setup.ts'],
    },
  };
});
