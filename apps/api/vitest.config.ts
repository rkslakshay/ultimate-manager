import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts', 'src/**/*.test.ts'],
    environment: 'node',
    globalSetup: ['./test/global-setup.ts'],
    // Starting embedded Postgres + migrating can take a while on a cold machine.
    hookTimeout: 120_000,
    testTimeout: 20_000,
  },
});
