import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { emailsPlugin } from '@payload-solutions/plugin-emails'
import sharp from 'sharp'
import { fileURLToPath } from 'url'

import { emails } from './emails.js'
import { testEmailAdapter } from './helpers/testEmailAdapter.js'
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
      hooks: {
        afterChange: [
          // Example call sites: both emails are typed from dev/payload-types.ts.
          async ({ doc, operation, req }) => {
            if (operation !== 'create' || isTest) {
              return
            }
            await req.payload.emails.send('welcome', {
              input: { url: `${req.payload.config.serverURL}/admin`, user: doc.id },
              req,
            })
            await req.payload.emails.send('new-user-notification', {
              input: { registeredAt: new Date().toISOString(), user: doc.id },
              req,
            })
          },
        ],
      },
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
    client: {
      url: process.env.DATABASE_URL || `file:${path.resolve(dirname, isTest ? 'test.db' : 'dev.db')}`,
    },
    push: true,
  }),
  editor: lexicalEditor(),
  email: testEmailAdapter,
  onInit: async (payload) => {
    await seed(payload)
  },
  plugins: [
    emailsPlugin({
      emails,
      log: { enabled: true, includeTests: true, storeVariables: true },
      settings: {
        adminRecipients: ['admin@example.com'],
        mediaCollection: 'media',
      },
    }),
  ],
  secret: process.env.PAYLOAD_SECRET || 'test-secret_key',
  serverURL: process.env.SERVER_URL || 'http://localhost:3300',
  sharp,
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
})
