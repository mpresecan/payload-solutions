import { resendBroadcastsPlugin } from '@payload-solutions/plugin-resend-broadcasts'
import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import sharp from 'sharp'
import { fileURLToPath } from 'url'

import { testEmailAdapter } from './helpers/testEmailAdapter.js'
import { resendMockBaseUrl } from './resend-mock/start.js'
import { seed } from './seed.js'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

if (!process.env.ROOT_DIR) {
  process.env.ROOT_DIR = dirname
}

const isTest = process.env.NODE_ENV === 'test'
const serverURL = process.env.SERVER_URL || 'http://localhost:3500'

// Without a real key the dev app (and the tests) talk to an in-memory Resend instead.
const resendBaseUrl = process.env.RESEND_API_KEY
  ? undefined
  : await resendMockBaseUrl({ isTest, serverURL })

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
      // A dedicated newsletter sign-up collection: the plugin adds `email`, `name` and `subscribed`.
      slug: 'subscribers',
      admin: { defaultColumns: ['email', 'name', 'plan', 'subscribed'], useAsTitle: 'email' },
      fields: [
        {
          name: 'plan',
          type: 'select',
          defaultValue: 'free',
          options: [
            { label: 'Free', value: 'free' },
            { label: 'Pro', value: 'pro' },
          ],
        },
        { name: 'company', type: 'text' },
      ],
    },
    {
      slug: 'media',
      // Newsletter images are fetched by mail clients, which never carry a login.
      access: { read: () => true },
      fields: [{ name: 'alt', type: 'text' }],
      upload: {
        staticDir: path.resolve(dirname, 'media'),
      },
    },
  ],
  db: sqliteAdapter({
    client: {
      url:
        process.env.DATABASE_URL || `file:${path.resolve(dirname, isTest ? 'test.db' : 'dev.db')}`,
    },
    push: true,
  }),
  editor: lexicalEditor(),
  email: testEmailAdapter,
  onInit: async (payload) => {
    if (!isTest) {
      await seed(payload)
    }
  },
  plugins: [
    resendBroadcastsPlugin({
      apiKey: process.env.RESEND_API_KEY || 're_dev_mock',
      from: process.env.RESEND_FROM || 'Acme Weekly <news@acme.test>',
      // The dev app serves uploads from localhost, which no real inbox could load; the tests turn
      // the check back on to exercise it.
      media: { allowPrivateUrls: true, collection: 'media' },
      resend: resendBaseUrl ? { baseUrl: resendBaseUrl, requestsPerSecond: 0 } : undefined,
      sources: [
        { collection: 'users' },
        {
          collection: 'subscribers',
          defaultSubscribed: true,
          properties: {
            company: {
              type: 'string',
              description: 'Company name',
              fallback: 'your team',
              value: ({ doc }) => doc.company,
            },
            plan: { type: 'string', description: 'Free or Pro', value: ({ doc }) => doc.plan },
          },
        },
      ],
      webhookSecret:
        process.env.RESEND_WEBHOOK_SECRET || 'whsec_ZGV2LXdlYmhvb2stc2VjcmV0LWZvci10aGUtbW9jaw==',
    }),
  ],
  secret: process.env.PAYLOAD_SECRET || 'test-secret_key',
  serverURL,
  sharp,
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
})
