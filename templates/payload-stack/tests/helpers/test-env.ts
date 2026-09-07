/**
 * Environment for the automated suites, shared by vitest.setup.ts (integration) and
 * playwright.config.ts / tests/e2e/global-setup.ts (end-to-end).
 *
 * Precedence, highest first:
 *   1. the real environment (CI, or a variable exported in your shell)
 *   2. test.env   the throwaway database and secrets the suites run against
 *   3. .env       your development values
 *
 * Neither file has to exist: on a fresh clone test.env alone carries everything the suites need.
 *
 * The end-to-end journeys additionally get their own database and their own port (E2E_DATABASE_URL
 * and E2E_PORT in test.env), so `pnpm test:e2e` starts its own dev server instead of reusing
 * whatever already listens on :3000 — which, if it belongs to another project, signs the test
 * users up into that project's database and leaves this one empty.
 */
import { fileURLToPath } from 'node:url'

import { config as loadEnv } from 'dotenv'

const fromRoot = (file: string) => fileURLToPath(new URL(`../../${file}`, import.meta.url))

export type Suite = 'int' | 'e2e'

/** Loads .env and test.env into process.env. Safe to call more than once. */
export function loadTestEnv(suite: Suite): void {
  // Captured before either file is read, so restoring it below lets CI's own values win.
  const fromEnvironment = Object.entries(process.env)

  loadEnv({ path: fromRoot('.env') })
  loadEnv({ path: fromRoot('test.env'), override: true })

  for (const [key, value] of fromEnvironment) {
    if (value !== undefined) process.env[key] = value
  }

  if (suite !== 'e2e') return

  const wasExported = new Set(fromEnvironment.map(([key]) => key))
  // CI points the journeys at its own service container and its own port; only fill in what it
  // did not pin.
  if (!wasExported.has('DATABASE_URL') && process.env.E2E_DATABASE_URL) {
    process.env.DATABASE_URL = process.env.E2E_DATABASE_URL
  }
  if (!wasExported.has('NEXT_PUBLIC_APP_URL') && process.env.E2E_PORT) {
    process.env.NEXT_PUBLIC_APP_URL = `http://localhost:${process.env.E2E_PORT}`
  }
}

/** The origin the journeys drive, once loadTestEnv('e2e') has run. */
export function e2eBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
}
