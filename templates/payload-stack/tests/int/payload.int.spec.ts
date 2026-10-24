import { getPayload, type Payload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import stack from '@/stack.config'

/**
 * Boots Payload against DATABASE_URL (see test.env / .env) and checks the pieces the boilerplate
 * relies on are wired: Better Auth collections, the tenants bridge on users, seeded legal pages.
 */
let payload: Payload

describe('Payload configuration', () => {
  beforeAll(async () => {
    payload = await getPayload({ config })
  })

  it('registers the Better Auth collections, and the organization ones only when organizations are on', () => {
    const slugs = payload.config.collections.map((c) => c.slug)
    for (const slug of ['users', 'sessions', 'accounts', 'verifications']) {
      expect(slugs).toContain(slug)
    }
    for (const slug of ['organizations', 'members', 'invitations']) {
      if (stack.features.organizations) expect(slugs).toContain(slug)
      else expect(slugs).not.toContain(slug)
    }
  })

  it.skipIf(!stack.features.organizations)('adds the multi-tenant array to users', () => {
    const users = payload.collections.users.config
    const tenants = users.fields.find((f) => 'name' in f && f.name === 'tenants')
    expect(tenants?.type).toBe('array')
  })

  it('attaches the Better Auth instance', () => {
    expect((payload as Payload & { betterAuth?: unknown }).betterAuth).toBeDefined()
  })

  it('seeds legal pages on first boot', async () => {
    const pages = await payload.find({ collection: 'legal-pages', overrideAccess: true })
    expect(pages.totalDocs).toBeGreaterThanOrEqual(3)
    expect(pages.docs.map((p) => p.slug)).toEqual(expect.arrayContaining(['privacy', 'terms', 'cookies']))
  })
})
