import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { actionScheduler } from '@payload-solutions/plugin-action-scheduler'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'

import { actions } from './actions.js'
import { seed } from './seed.js'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

if (!process.env.ROOT_DIR) {
  process.env.ROOT_DIR = dirname
}

const isTest = process.env.NODE_ENV === 'test'

export default buildConfig({
  admin: {
    importMap: {
      baseDir: path.resolve(dirname),
    },
    user: 'users',
  },
  collections: [
    {
      slug: 'users',
      admin: { useAsTitle: 'email' },
      auth: true,
      fields: [{ name: 'name', type: 'text' }],
    },
  ],
  db: sqliteAdapter({
    client: {
      url: process.env.DATABASE_URL || `file:${path.resolve(dirname, isTest ? 'test.db' : 'dev.db')}`,
    },
    push: true,
  }),
  jobs: {
    // While `pnpm dev` runs, Payload itself runs the queue and the maintenance tick every minute, so
    // the admin shows "Runner active". Set SCHEDULER_AUTORUN=false to drive everything from the
    // Run queue button instead (tests never autorun).
    autoRun: isTest || process.env.SCHEDULER_AUTORUN === 'false' ? undefined : [{ cron: '* * * * *', queue: 'default' }],
  },
  onInit: async (payload) => {
    await seed(payload)
  },
  plugins: [
    actionScheduler({
      actions,
      defaultBackoff: { type: 'fixed', delay: '1s' },
      dispatchHorizon: '15m',
      recurring: [{ key: 'analytics.hourly', hook: 'analytics.rollup', cron: '0 * * * *', tz: 'Europe/Warsaw' }],
      retention: { complete: '1d', canceled: '1d', failed: '7d' },
      tick: isTest ? false : { cron: '* * * * *' },
    }),
  ],
  secret: process.env.PAYLOAD_SECRET || 'test-secret_key',
  serverURL: process.env.SERVER_URL || 'http://localhost:3310',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
})
