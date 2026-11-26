import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests run against the full stack started by Docker Compose
 * (`docker compose up -d --wait`), or any URL given in E2E_BASE_URL.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:8080',
    trace: 'off',
    screenshot: 'only-on-failure',
    // Optional: point at an already-installed Chromium instead of Playwright's download.
    launchOptions: process.env.PW_CHROMIUM_PATH
      ? { executablePath: process.env.PW_CHROMIUM_PATH }
      : {},
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
