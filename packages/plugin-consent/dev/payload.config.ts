import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { consentPlugin } from '@payload-solutions/plugin-consent'
import path from 'path'
import { buildConfig } from 'payload'
import sharp from 'sharp'
import { fileURLToPath } from 'url'

import { testEmailAdapter } from './helpers/testEmailAdapter.js'
import { seed } from './seed.js'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

if (!process.env.ROOT_DIR) {
  process.env.ROOT_DIR = dirname
}

/** Tests get a throwaway database; `pnpm dev` uses ./dev/payload-consent.db (git-ignored). */
const databaseUrl =
  process.env.NODE_ENV === 'test'
    ? `file:${path.resolve(dirname, `.test-${process.pid}.db`)}`
    : process.env.DATABASE_URL || `file:${path.resolve(dirname, 'payload-consent.db')}`

export default buildConfig({
  admin: {
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections: [
    {
      slug: 'posts',
      fields: [{ name: 'title', type: 'text' }],
    },
    {
      slug: 'media',
      fields: [],
      upload: {
        staticDir: path.resolve(dirname, 'media'),
      },
    },
  ],
  db: sqliteAdapter({
    client: { url: databaseUrl },
    push: true,
  }),
  editor: lexicalEditor(),
  email: testEmailAdapter,
  onInit: async (payload) => {
    await seed(payload)
  },
  plugins: [
    consentPlugin({
      recording: { mode: 'anonymous' },
      seed: {
        company: {
          name: 'Acme',
          legalName: 'Acme Ltd',
          address: '1 Main Street, Dublin, Ireland',
          email: 'privacy@acme.test',
          url: 'https://acme.test',
          governingLaw: 'Ireland',
          jurisdictions: ['EEA', 'GB'],
        },
        trackers: [
          { key: 'posthog', vars: { projectKey: 'phc_dev' } },
          { key: 'ga4', vars: { measurementId: 'G-DEV000000' } },
          'stripe',
          'youtube',
        ],
        processors: ['vercel', 'neon', 'resend', 'stripe', 'posthog', 'sentry', 'ga4'],
      },
      jobs: { purge: { cron: '0 3 * * *' } },
    }),
  ],
  secret: process.env.PAYLOAD_SECRET || 'test-secret_key',
  sharp,
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
})
