import { defineConfig, devices } from '@playwright/test'

/**
 * E2E runs the dev admin (port 3400) against the mock Vercel server (port 3399), so no Vercel account is
 * needed. The mock builds fast so the widget reaches "Ready" within a poll or two.
 */
const MOCK = 'http://127.0.0.1:3399'
const PROJECT = 'prj_e2e000000000000000000'

export default defineConfig({
  testDir: './dev',
  testMatch: '**/e2e.spec.{ts,js}',
  /* One Next dev server backed by one sqlite file: parallel workers only fight over it. */
  fullyParallel: false,
  workers: 1,
  /* Next compiles each admin route on its first hit, so a cold run is slow. */
  timeout: 120_000,
  expect: { timeout: 30_000 },
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'html',
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  use: {
    baseURL: 'http://localhost:3400',
    trace: 'on-first-retry',
  },
  webServer: [
    {
      command: 'node dev/vercel-mock/server.mjs',
      env: { VERCEL_MOCK_BUILD_DELAY_MS: '500', VERCEL_MOCK_BUILD_TIME_MS: '1500', VERCEL_MOCK_PORT: '3399' },
      reuseExistingServer: true,
      url: `${MOCK}/__mock/state`,
    },
    {
      command: 'pnpm dev',
      env: {
        VERCEL_API_BASE: MOCK,
        // Every page.goto() is a full navigation, and the tab-close beacon would flush the pending window on each.
        VERCEL_BEACON: 'false',
        VERCEL_DEPLOY_HOOK_PRODUCTION: `${MOCK}/v1/integrations/deploy/${PROJECT}/hook_production`,
        VERCEL_DEPLOY_HOOK_STAGING: `${MOCK}/v1/integrations/deploy/${PROJECT}/hook_staging`,
        // Long enough that automatic deployment never races the manual Deploy flow the spec drives.
        VERCEL_QUIET_PERIOD: '10m',
        VERCEL_TOKEN: 'e2e-token',
      },
      reuseExistingServer: true,
      // The dev app compiles the Payload admin on first request, which is well past the 60s default.
      timeout: 180_000,
      url: 'http://localhost:3400/admin',
    },
  ],
})
