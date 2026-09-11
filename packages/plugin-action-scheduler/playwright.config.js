import { defineConfig, devices } from '@playwright/test'

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// import dotenv from 'dotenv';
// import path from 'path';
// dotenv.config({ path: path.resolve(__dirname, '.env') });

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './dev',
  testMatch: '**/e2e.spec.{ts,js}',
  /* One Next dev server backed by one sqlite file: parallel workers only fight over it. */
  fullyParallel: false,
  workers: 1,
  /* Next compiles each admin route on its first hit, so a cold run is slow. */
  timeout: 120_000,
  expect: { timeout: 20_000 },
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: 'http://localhost:3310',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'pnpm dev',
    reuseExistingServer: true,
    // The dev app compiles the Payload admin on first request, which is well past the 60s default.
    timeout: 180_000,
    url: 'http://localhost:3310/admin',
  },
})
