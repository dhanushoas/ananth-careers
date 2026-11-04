import { defineConfig, devices } from '@playwright/test';

/**
 * E2E tests run against a live dev stack:
 *   1. backend on http://localhost:4000 (seeded), 2. `npm start` (http://localhost:4200, proxies /api).
 * Set PW_WEB_SERVER=1 to let Playwright start `npm start` itself; PW_BASE_URL overrides the base URL.
 */
const baseURL = process.env['PW_BASE_URL'] ?? 'http://localhost:4200';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env['CI'] ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: process.env['PW_WEB_SERVER']
    ? {
        command: 'npm start',
        url: baseURL,
        reuseExistingServer: true,
        timeout: 180_000,
      }
    : undefined,
});
