import { defineConfig, devices } from '@playwright/test'

/** See https://playwright.dev/docs/test-configuration. */
export default defineConfig({
  testDir: './dev',
  testMatch: '**/e2e.spec.{ts,js}',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 90_000,
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        ...(process.env.PLAYWRIGHT_CHROMIUM_PATH ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } } : {}),
      },
    },
  ],
  use: {
    baseURL: 'http://localhost:3320',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'pnpm dev',
    reuseExistingServer: true,
    url: 'http://localhost:3320/admin',
    timeout: 240_000,
  },
})
