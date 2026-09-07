import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright journeys (tests/e2e) against a dev server this config starts itself, on E2E_PORT
 * (3456 by default) against the throwaway end-to-end database: see test.env and
 * tests/helpers/test-env.ts. Running on its own port matters, because a server already listening
 * on :3000 may belong to another project, and the journeys would then create their users in that
 * project's database.
 *
 * Users and organizations are created per test through Better Auth's HTTP API
 * (tests/e2e/fixtures.ts); a site admin is created once in tests/e2e/global-setup.ts.
 *
 * PLAYWRIGHT_CHROMIUM_PATH uses an existing Chromium instead of the downloaded one.
 */
import { e2eBaseUrl, loadTestEnv } from './tests/helpers/test-env'

loadTestEnv('e2e')

const baseURL = e2eBaseUrl()
const port = new URL(baseURL).port || '3000'

export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Journeys share one database and one dev server; keep them sequential to stay deterministic. */
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL,
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chromium',
        // Point at an existing Chromium (CI images, sandboxes) instead of the downloaded one.
        launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : undefined,
      },
    },
  ],
  webServer: {
    command: `pnpm dev --port ${port}`,
    // Only a leftover server from a previous run can be listening here, and it was started with
    // the same environment; anything else would be a different app on a port we chose ourselves.
    reuseExistingServer: !process.env.CI,
    url: `${baseURL}/api/auth/ok`,
    timeout: 180_000,
    // `pnpm dev` inherits process.env, but spell out what the journeys depend on.
    env: {
      DATABASE_URL: process.env.DATABASE_URL ?? '',
      NEXT_PUBLIC_APP_URL: baseURL,
    },
  },
})
