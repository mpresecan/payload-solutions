import type { Config } from 'payload'

import path from 'path'
import { buildConfig } from 'payload'
import { vercelPlugin } from '@payload-solutions/plugin-vercel'
import { fileURLToPath } from 'url'

import { seed } from './seed.js'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

if (!process.env.ROOT_DIR) {
  process.env.ROOT_DIR = dirname
}

const isTest = process.env.NODE_ENV === 'test'

/** SQLite by default; a `postgres://` DATABASE_URL switches adapters (the cloud test harness uses Postgres). */
async function database(): Promise<Config['db']> {
  const url = process.env.DATABASE_URL
  if (url?.startsWith('postgres')) {
    const { postgresAdapter } = await import('@payloadcms/db-postgres')
    return postgresAdapter({ pool: { connectionString: url }, push: true })
  }
  const { sqliteAdapter } = await import('@payloadcms/db-sqlite')
  return sqliteAdapter({
    client: { url: url || `file:${path.resolve(dirname, isTest ? 'test.db' : 'dev.db')}` },
    push: true,
  })
}

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
    {
      // Drafts: only publishes count.
      slug: 'pages',
      admin: { useAsTitle: 'title' },
      fields: [
        { name: 'title', type: 'text', required: true },
        { name: 'body', type: 'textarea' },
      ],
      versions: { drafts: true },
    },
    {
      // No drafts: every save counts, production target only.
      slug: 'posts',
      admin: { useAsTitle: 'title' },
      fields: [
        { name: 'title', type: 'text', required: true },
        { name: 'excerpt', type: 'textarea' },
      ],
    },
    {
      // Not tracked: never records a change.
      slug: 'notes',
      fields: [{ name: 'text', type: 'text' }],
    },
  ],
  db: await database(),
  globals: [
    {
      slug: 'site-settings',
      fields: [
        { name: 'siteName', type: 'text' },
        { name: 'tagline', type: 'text' },
      ],
      label: 'Site settings',
    },
  ],
  onInit: async (payload) => {
    await seed(payload)
  },
  plugins: [
    vercelPlugin({
      apiBase: process.env.VERCEL_API_BASE,
      autoDeploy: { maxWait: process.env.VERCEL_MAX_WAIT ?? '10m', quietPeriod: process.env.VERCEL_QUIET_PERIOD ?? '60s' },
      collections: {
        pages: true,
        posts: { targets: ['production'] },
      },
      globals: { 'site-settings': true },
      hooks: {
        onError: ({ record }) => {
          if (!isTest) {
            console.log(`[dev] deploy failed: ${record.target} ${record.errorMessage ?? ''}`)
          }
        },
        onReady: ({ record }) => {
          if (!isTest) {
            console.log(`[dev] deploy ready: ${record.target} ${record.deploymentUrl ?? ''}`)
          }
        },
      },
      retention: { days: Number(process.env.VERCEL_RETENTION_DAYS ?? 90), keep: Number(process.env.VERCEL_RETENTION_KEEP ?? 200) },
      targets: [
        {
          slug: 'production',
          hook: process.env.VERCEL_DEPLOY_HOOK_PRODUCTION,
          label: 'Website',
          url: 'https://example.com',
        },
        {
          slug: 'staging',
          hook: process.env.VERCEL_DEPLOY_HOOK_STAGING,
          label: 'Staging',
        },
      ],
      teamId: process.env.VERCEL_TEAM_ID,
      tick: { beacon: process.env.VERCEL_BEACON !== 'false', job: { queue: 'vercel' }, secret: process.env.VERCEL_TICK_SECRET },
      token: process.env.VERCEL_TOKEN,
      webhookSecret: process.env.VERCEL_WEBHOOK_SECRET,
    }),
  ],
  secret: process.env.PAYLOAD_SECRET || 'test-secret_key',
  serverURL: process.env.SERVER_URL || 'http://localhost:3400',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
})
