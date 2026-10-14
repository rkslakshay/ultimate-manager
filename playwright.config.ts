import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:5173';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  // The API is a single Node process doing CPU-bound work (password hashing, world generation);
  // two workers keep the suite fast without queueing requests past assertion timeouts.
  workers: 2,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev',
    url: `${baseURL}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: 'pipe',
    // Only applies when Playwright starts the server (CI): cheaper hashing, and the suite
    // registers more accounts per minute than the production auth rate limit allows.
    env: { BCRYPT_ROUNDS: '8', RATE_LIMIT_AUTH_MAX: '1000' },
  },
});
