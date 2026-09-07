import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'
import { defineConfig } from 'vitest/config'

/**
 * Two Vitest projects:
 *
 *   unit  tests/unit/**  no database, no network. Every module is exercised under every
 *         stack.config.ts option through tests/helpers/with-stack.ts, so a change to an option's
 *         behaviour fails here first. `pnpm test:unit`
 *   int   tests/int/**   boots Payload + Better Auth against DATABASE_URL (see .env / test.env)
 *         and drives the real auth, organization, tenancy and access-control code paths.
 *         `pnpm test:int`
 *
 * Playwright journeys live in tests/e2e (see playwright.config.ts). `pnpm test` runs all three.
 */
const shared = {
  plugins: [tsconfigPaths(), react()],
  resolve: {
    alias: {
      // Modules guarded with `import 'server-only'` are imported directly by tests.
      'server-only': fileURLToPath(new URL('./tests/helpers/server-only.ts', import.meta.url)),
    },
  },
}

export default defineConfig({
  ...shared,
  test: {
    server: {
      deps: {
        // payload-auth ships directory imports that Node ESM cannot resolve; let Vite bundle it.
        inline: ['payload-auth'],
      },
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'node',
          include: ['tests/unit/**/*.spec.{ts,tsx}'],
          setupFiles: ['./tests/unit/setup.ts'],
          testTimeout: 20_000,
        },
      },
      {
        extends: true,
        test: {
          name: 'int',
          environment: 'node',
          include: ['tests/int/**/*.int.spec.ts'],
          setupFiles: ['./vitest.setup.ts'],
          // One Payload instance per worker pushes the schema on boot; keep files sequential so two
          // workers never migrate the same database at once.
          fileParallelism: false,
          testTimeout: 60_000,
          hookTimeout: 120_000,
        },
      },
    ],
  },
})
