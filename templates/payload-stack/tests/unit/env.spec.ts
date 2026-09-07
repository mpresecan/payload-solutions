/**
 * src/lib/env.ts: server environment validation. The module parses process.env at import, so each
 * case stubs the environment, resets the module graph and imports it again.
 */
import { describe, expect, it, vi } from 'vitest'

import { loadWithEnv } from '../helpers/with-stack'

const required = {
  DATABASE_URL: 'postgres://postgres:postgres@127.0.0.1:5432/app',
  PAYLOAD_SECRET: 'a-secret',
}

const loadEnv = (vars: Record<string, string | undefined>) => loadWithEnv(vars, () => import('@/lib/env'))

describe('env', () => {
  it('loads with only the required variables and applies defaults', async () => {
    const { env } = await loadEnv({
      ...required,
      NEXT_PUBLIC_APP_URL: undefined,
      EMAIL_FROM: undefined,
      BETTER_AUTH_SECRET: undefined,
    })
    expect(env.DATABASE_URL).toBe(required.DATABASE_URL)
    expect(env.PAYLOAD_SECRET).toBe('a-secret')
    expect(env.NODE_ENV).toBe('test')
    expect(env.NEXT_PUBLIC_APP_URL).toBe('http://localhost:3000')
    expect(env.EMAIL_FROM).toBe('onboarding@resend.dev')
    expect(env.BETTER_AUTH_SECRET).toBeUndefined()
    expect(env.RESEND_API_KEY).toBeUndefined()
    expect(env.STRIPE_SECRET_KEY).toBeUndefined()
  })

  it.each(['DATABASE_URL', 'PAYLOAD_SECRET'])('fails at import when %s is missing, naming the variable', async (key) => {
    await expect(loadEnv({ ...required, [key]: undefined })).rejects.toThrow(new RegExp(`Invalid environment variables:[\\s\\S]*${key}`))
  })

  it('treats an empty required variable as missing', async () => {
    await expect(loadEnv({ ...required, PAYLOAD_SECRET: '' })).rejects.toThrow(/PAYLOAD_SECRET/)
  })

  it('validates NEXT_PUBLIC_APP_URL as a URL', async () => {
    await expect(loadEnv({ ...required, NEXT_PUBLIC_APP_URL: 'app.example.com' })).rejects.toThrow(/NEXT_PUBLIC_APP_URL/)
    const { env } = await loadEnv({ ...required, NEXT_PUBLIC_APP_URL: 'https://app.example.com' })
    expect(env.NEXT_PUBLIC_APP_URL).toBe('https://app.example.com')
  })

  it('rejects an unknown NODE_ENV', async () => {
    await expect(loadEnv({ ...required, NODE_ENV: 'staging' })).rejects.toThrow(/NODE_ENV/)
  })

  it('rejects empty strings for optional secrets instead of treating them as set', async () => {
    await expect(loadEnv({ ...required, STRIPE_SECRET_KEY: '' })).rejects.toThrow(/STRIPE_SECRET_KEY/)
  })

  it('reads every optional integration variable', async () => {
    const optional = {
      BETTER_AUTH_SECRET: 'ba-secret',
      RESEND_API_KEY: 're_123',
      EMAIL_FROM: 'hello@example.com',
      EMAIL_FROM_NAME: 'Example',
      STRIPE_SECRET_KEY: 'sk_test_1',
      STRIPE_WEBHOOK_SECRET: 'whsec_1',
      GOOGLE_CLIENT_ID: 'g-id',
      GOOGLE_CLIENT_SECRET: 'g-secret',
      GITHUB_CLIENT_ID: 'gh-id',
      GITHUB_CLIENT_SECRET: 'gh-secret',
      MICROSOFT_CLIENT_ID: 'ms-id',
      MICROSOFT_CLIENT_SECRET: 'ms-secret',
      APPLE_CLIENT_ID: 'ap-id',
      APPLE_CLIENT_SECRET: 'ap-secret',
      DISCORD_CLIENT_ID: 'dc-id',
      DISCORD_CLIENT_SECRET: 'dc-secret',
    }
    const { env } = await loadEnv({ ...required, ...optional })
    expect(env).toMatchObject(optional)
  })

  it('reads the variables of every media storage adapter the CLI can wire in', async () => {
    // One entry per adapter in packages/create-payload-stack/src/storage.ts; the scaffolded
    // payload.config.ts reads them through `env`, so they must exist on the schema.
    const storage = {
      BLOB_READ_WRITE_TOKEN: 'vercel_blob_rw_1',
      S3_BUCKET: 'bucket',
      S3_REGION: 'eu-central-1',
      S3_ACCESS_KEY_ID: 's3-id',
      S3_SECRET_ACCESS_KEY: 's3-secret',
      S3_ENDPOINT: 'https://s3.example',
      R2_BUCKET: 'r2-bucket',
      R2_ENDPOINT: 'https://r2.example',
      R2_ACCESS_KEY_ID: 'r2-id',
      R2_SECRET_ACCESS_KEY: 'r2-secret',
      R2_PUBLIC_URL: 'https://cdn.example',
      AZURE_STORAGE_CONNECTION_STRING: 'DefaultEndpointsProtocol=https;AccountName=x',
      AZURE_STORAGE_CONTAINER_NAME: 'media',
      AZURE_STORAGE_ACCOUNT_BASEURL: 'https://x.blob.core.windows.net',
      AZURE_STORAGE_ALLOW_CONTAINER_CREATE: 'true',
      GCS_BUCKET: 'gcs-bucket',
      GCS_PROJECT_ID: 'project',
      GCS_SERVICE_ACCOUNT_KEY: '{"type":"service_account"}',
      UPLOADTHING_TOKEN: 'ut_1',
    }
    const { env } = await loadEnv({ ...required, ...storage })
    expect(env).toMatchObject(storage)

    // Absent, they are simply undefined: local disk storage needs none of them.
    const { env: bare } = await loadEnv({ ...required, ...Object.fromEntries(Object.keys(storage).map((key) => [key, undefined])) })
    for (const key of Object.keys(storage) as (keyof typeof storage)[]) expect(bare[key]).toBeUndefined()
  })

  it('billingReady needs both Stripe keys', async () => {
    const none = await loadEnv({ ...required, STRIPE_SECRET_KEY: undefined, STRIPE_WEBHOOK_SECRET: undefined })
    expect(none.billingReady).toBe(false)
    const secretOnly = await loadEnv({ ...required, STRIPE_SECRET_KEY: 'sk_test_1', STRIPE_WEBHOOK_SECRET: undefined })
    expect(secretOnly.billingReady).toBe(false)
    const both = await loadEnv({ ...required, STRIPE_SECRET_KEY: 'sk_test_1', STRIPE_WEBHOOK_SECRET: 'whsec_1' })
    expect(both.billingReady).toBe(true)
  })

  it('ignores unrelated variables', async () => {
    const { env } = await loadEnv({ ...required, SOMETHING_ELSE: 'x' })
    expect(env).not.toHaveProperty('SOMETHING_ELSE')
  })

  describe('requireEnv', () => {
    it('returns the value when set', async () => {
      const { requireEnv } = await loadEnv({ ...required, STRIPE_SECRET_KEY: 'sk_test_1' })
      expect(requireEnv('STRIPE_SECRET_KEY', 'for billing')).toBe('sk_test_1')
    })

    it('throws with the variable name and the reason when unset', async () => {
      const { requireEnv } = await loadEnv({ ...required, STRIPE_SECRET_KEY: undefined })
      expect(() => requireEnv('STRIPE_SECRET_KEY', 'for billing')).toThrow('STRIPE_SECRET_KEY is required for billing')
    })
  })

  it('does not evaluate process.env lazily: a variable set after import is not seen', async () => {
    const { env } = await loadEnv({ ...required, RESEND_API_KEY: undefined })
    vi.stubEnv('RESEND_API_KEY', 're_late')
    expect(env.RESEND_API_KEY).toBeUndefined()
  })
})
