/**
 * src/app/sitemap.ts and src/app/robots.ts: the public pages crawlers are pointed at, and the
 * private areas they are kept out of. Payload is faked; stack.config.ts varies by preset.
 */
import { describe, expect, it, vi } from 'vitest'

import { presets } from '../helpers/stack-fixtures'
import { loadWithStack } from '../helpers/with-stack'

const legalDocs = [
  { id: 1, slug: 'privacy', updatedAt: '2026-03-01T00:00:00.000Z' },
  { id: 2, slug: 'terms', updatedAt: '2026-03-02T00:00:00.000Z' },
]

async function loadSitemap(input: Parameters<typeof loadWithStack>[0], find: () => Promise<unknown>) {
  const payload = { find: vi.fn(find) }
  vi.doMock('@/lib/payload', () => ({ getPayloadClient: async () => payload }))
  const mod = await loadWithStack(input, () => import('@/app/sitemap'))
  vi.doUnmock('@/lib/payload')
  return { entries: await mod.default(), payload }
}

describe('sitemap.xml', () => {
  it('lists the homepage, pricing and every readable legal page', async () => {
    const { entries, payload } = await loadSitemap(presets['billing-org'], async () => ({ docs: legalDocs }))
    expect(entries.map((e) => e.url)).toEqual([
      'http://localhost:3000/',
      'http://localhost:3000/pricing',
      'http://localhost:3000/legal/privacy',
      'http://localhost:3000/legal/terms',
    ])
    expect(entries[2]?.lastModified).toEqual(new Date('2026-03-01T00:00:00.000Z'))
    // Only what a visitor may read: access control applies.
    expect(payload.find).toHaveBeenCalledWith(expect.objectContaining({ collection: 'legal-pages', overrideAccess: false }))
  })

  it('leaves pricing out when billing is off', async () => {
    const { entries } = await loadSitemap(presets['orgs-off'], async () => ({ docs: [] }))
    expect(entries.map((e) => e.url)).not.toContain('http://localhost:3000/pricing')
  })

  it('still answers without a database', async () => {
    const { entries } = await loadSitemap(presets['billing-org'], async () => {
      throw new Error('no database')
    })
    expect(entries.map((e) => e.url)).toEqual(['http://localhost:3000/', 'http://localhost:3000/pricing'])
  })
})

describe('robots.txt', () => {
  it('allows the site, keeps crawlers out of the app, auth, admin and API, and links the sitemap', async () => {
    const mod = await loadWithStack(presets.defaults, () => import('@/app/robots'))
    const robots = mod.default()
    expect(robots.rules).toEqual({
      userAgent: '*',
      allow: '/',
      disallow: ['/dashboard', '/onboarding', '/auth', '/admin', '/api'],
    })
    expect(robots.sitemap).toBe('http://localhost:3000/sitemap.xml')
  })
})
