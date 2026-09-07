import type { Payload, PayloadRequest } from 'payload'

import config from '@payload-config'
import { decodeConsentCookie, encodeConsentCookie, type ConsentConfig } from '@payload-solutions/consent-core'
import { getPluginOptions } from '@payload-solutions/plugin-consent'
import {
  getConsentConfig,
  getConsentOverview,
  getSubprocessors,
  purgeExpiredRecords,
  readConsent,
} from '@payload-solutions/plugin-consent/server'
import { createPayloadRequest, getPayload } from 'payload'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

import { resetRateLimits } from '../src/rate-limit.js'

let payload: Payload
const uuid = '6b1f7e0e-9a1c-4a4a-9c1e-2f9f0f7a1b2c'

/** Runs an endpoint registered by the plugin through a real PayloadRequest, like the template does. */
async function call(path: string, init: { body?: unknown; headers?: Record<string, string>; method?: string } = {}) {
  const method = (init.method ?? 'GET').toUpperCase()
  const request = new Request(`http://localhost:3000/api${path}`, {
    body: init.body ? JSON.stringify(init.body) : undefined,
    headers: { ...(init.body ? { 'content-type': 'application/json' } : {}), ...init.headers },
    method,
  })
  const req: PayloadRequest = await createPayloadRequest({ config, request })
  const endpoint = payload.config.endpoints.find(
    (e) => e.method === method.toLowerCase() && e.path === path.split('?')[0],
  )
  if (!endpoint) {
    throw new Error(`no endpoint ${method} ${path}`)
  }
  return endpoint.handler(req)
}

beforeAll(async () => {
  payload = await getPayload({ config })
})

afterAll(async () => {
  await payload.destroy()
})

describe('registration and seeds', () => {
  test('registers the collections, global, endpoints and job', () => {
    const slugs = payload.config.collections.map((c) => c.slug)
    expect(slugs).toEqual(
      expect.arrayContaining(['consent-categories', 'consent-trackers', 'consent-records', 'legal-pages', 'consent-processors']),
    )
    expect(payload.config.globals.map((g) => g.slug)).toContain('consent-settings')
    expect(payload.config.endpoints.map((e) => `${e.method} ${e.path}`)).toEqual(
      expect.arrayContaining(['get /consent/config', 'post /consent/records', 'get /consent/records/me']),
    )
    expect(payload.config.jobs.tasks?.map((t) => t.slug)).toContain('consentPurgeRecords')
    expect(payload.config.admin.components?.beforeDashboard).toContain(
      '@payload-solutions/plugin-consent/rsc#ConsentOverview',
    )
  })

  test('seeds categories, preset trackers and legal pages once', async () => {
    const categories = await payload.find({ collection: 'consent-categories', overrideAccess: true, sort: 'order' })
    expect(categories.docs.map((c) => c.key)).toEqual(['necessary', 'functional', 'analytics', 'marketing'])

    const trackers = await payload.find({ collection: 'consent-trackers', overrideAccess: true })
    expect(trackers.docs.map((t) => t.presetKey).sort()).toEqual(['ga4', 'posthog', 'stripe', 'youtube'])
    const ga = trackers.docs.find((t) => t.presetKey === 'ga4')!
    expect(ga.loader?.src).toBe('https://www.googletagmanager.com/gtag/js?id=G-DEV000000')

    const pages = await payload.find({ collection: 'legal-pages', overrideAccess: true, sort: 'slug' })
    expect(pages.docs.map((p) => `${p.kind}:${p.slug}:${p._status}`)).toEqual([
      'cookies:cookies:published',
      'dpa:dpa:published',
      'privacy:privacy:published',
      'subprocessors:subprocessors:published',
      'terms:terms:published',
    ])
    const cookiesPage = pages.docs.find((p) => p.kind === 'cookies')!
    const nodes = (cookiesPage.content as { root: { children: Array<{ fields?: { blockType?: string }; type: string }> } })
      .root.children
    expect(nodes.some((n) => n.type === 'block' && n.fields?.blockType === 'cookieTable')).toBe(true)
    expect(nodes.some((n) => n.type === 'block' && n.fields?.blockType === 'policyVersion')).toBe(true)

    const settings = await payload.findGlobal({ slug: 'consent-settings', depth: 0, overrideAccess: true })
    expect(settings.versions?.policyVersion).toMatch(/^[0-9a-f]{8}$/)
    expect(settings.banner?.privacyPage).toBeTruthy()
  })

  test('converts markdown tables in the seeded documents into Lexical table nodes', async () => {
    const pages = await payload.find({ collection: 'legal-pages', overrideAccess: true, sort: 'slug' })
    // privacy, terms and the DPA are written with GFM pipe tables; the cookie policy and the
    // sub-processor page get theirs from blocks instead.
    for (const page of pages.docs.filter((p) => ['privacy', 'terms', 'dpa'].includes(String(p.kind)))) {
      const root = (page.content as { root: { children: LexicalNode[] } }).root
      const tables = root.children.filter((n) => n.type === 'table')
      expect(tables.length, `${page.slug} should contain tables`).toBeGreaterThan(0)

      // Header row cells carry a header state, so they render as <th>.
      const firstRow = tables[0]!.children?.[0]
      expect(firstRow?.type).toBe('tablerow')
      expect(firstRow?.children?.every((c) => c.type === 'tablecell' && Number(c.headerState) > 0)).toBe(true)

      // Every body row has the same number of cells as the header row.
      const columns = firstRow?.children?.length
      for (const row of tables[0]!.children ?? []) {
        expect(row.children?.length).toBe(columns)
      }

      // And no pipe-delimited row survived as literal paragraph text.
      expect(plainText(root.children).filter((t) => /^\|.*\|$/.test(t))).toEqual([])
    }
  })
})

type LexicalNode = { children?: LexicalNode[]; fields?: { blockType?: string; mode?: string }; headerState?: number; text?: string; type: string }

/** Trimmed text of every top-level paragraph, used to prove nothing stayed as raw markdown. */
function plainText(nodes: LexicalNode[]): string[] {
  return nodes
    .filter((n) => n.type === 'paragraph')
    .map((n) => (n.children ?? []).map((c) => c.text ?? '').join('').trim())
}

describe('processors', () => {
  test('seeds the register unverified, with a sub-processor version of its own', async () => {
    const processors = await payload.find({ collection: 'consent-processors', overrideAccess: true, sort: 'name' })
    expect(processors.docs.map((p) => p.presetKey)).toEqual(['ga4', 'neon', 'posthog', 'resend', 'sentry', 'stripe', 'vercel'])
    expect(processors.docs.every((p) => p.verified === false)).toBe(true)
    expect(processors.docs.every((p) => typeof p.addedAt === 'string')).toBe(true)

    // Roles are not all "processor": Stripe decides its own anti-fraud purposes.
    expect(processors.docs.find((p) => p.presetKey === 'stripe')?.role).toBe('independent-controller')
    // An adequacy-based transfer carries an SCC fallback, so Schrems III does not stop the transfer.
    expect(processors.docs.find((p) => p.presetKey === 'ga4')?.transfer).toMatchObject({ mechanism: 'dpf', fallback: 'scc' })
    // GA4 is a recipient to disclose but not a sub-processor of customer data.
    expect(processors.docs.find((p) => p.presetKey === 'ga4')?.subprocessor).toBe(false)

    const settings = await payload.findGlobal({ slug: 'consent-settings', depth: 0, overrideAccess: true })
    expect(settings.processors?.subprocessorsVersion).toMatch(/^[0-9a-f]{8}$/)
    expect(settings.processors?.noticeDays).toBe(30)
  })

  test('changing a sub-processor moves its own version and leaves the consent policy version alone', async () => {
    const before = await payload.findGlobal({ slug: 'consent-settings', depth: 0, overrideAccess: true })
    const row = (await payload.find({ collection: 'consent-processors', overrideAccess: true, where: { presetKey: { equals: 'resend' } } })).docs[0]!
    await payload.update({
      collection: 'consent-processors',
      id: row.id,
      data: { status: 'removed', removedAt: new Date().toISOString() } as never,
      overrideAccess: true,
    })
    const after = await payload.findGlobal({ slug: 'consent-settings', depth: 0, overrideAccess: true })
    expect(after.processors?.subprocessorsVersion).not.toBe(before.processors?.subprocessorsVersion)
    expect(after.versions?.policyVersion).toBe(before.versions?.policyVersion)

    // It leaves the active list and shows up in the change log.
    const list = await getSubprocessors(payload, getPluginOptions(payload))
    expect(list.processors.map((p) => p.name)).not.toContain('Resend')
    expect(list.changes.some((c) => c.name === 'Resend' && c.change === 'removed')).toBe(true)

    await payload.update({ collection: 'consent-processors', id: row.id, data: { status: 'active', removedAt: null } as never, overrideAccess: true })
  })

  test('serves GET /api/consent/subprocessors', async () => {
    const res = await call('/consent/subprocessors')
    expect(res.status).toBe(200)
    const body = (await res.json()) as { noticeDays: number; processors: Array<{ name: string; verified: boolean }>; version: string }
    expect(body.version).toMatch(/^[0-9a-f]{8}$/)
    expect(body.noticeDays).toBe(30)
    expect(body.processors.map((p) => p.name)).toContain('Vercel')
    expect(body.processors.map((p) => p.name)).not.toContain('Google Analytics 4')
  })

  test('the privacy policy carries recipients and transfers tables, and the DPA carries Annex III', async () => {
    const pages = await payload.find({ collection: 'legal-pages', overrideAccess: true })
    const modes = (slug: string) =>
      ((pages.docs.find((p) => p.slug === slug)!.content as { root: { children: LexicalNode[] } }).root.children ?? [])
        .filter((n) => n.type === 'block' && n.fields?.blockType === 'processorTable')
        .map((n) => n.fields!.mode)

    expect(modes('privacy')).toEqual(['recipients', 'transfers'])
    expect(modes('subprocessors')).toEqual(['subprocessors', 'changes'])
    expect(modes('dpa')).toEqual(['annex'])
  })

  test('the dashboard warns about unverified rows and about trackers missing from the register', async () => {
    const overview = await getConsentOverview(payload)
    expect(overview.processors).toBe(7)
    expect(overview.warnings.join(' ')).toMatch(/have not been checked against a signed contract/)
    // YouTube is declared as a tracker but was never added to the register.
    expect(overview.warnings.join(' ')).toMatch(/YouTube embeds.*not in the processor register/)
  })
})

describe('config', () => {
  test('assembles the client config and resolves the jurisdiction from headers', async () => {
    const de = await getConsentConfig(payload, { headers: new Headers({ 'x-vercel-ip-country': 'DE' }) })
    expect(de.enabled).toBe(true)
    expect(de.jurisdiction).toEqual({ country: 'DE', model: 'opt-in' })
    expect(de.categories.map((c) => c.key)).toEqual(['necessary', 'functional', 'analytics', 'marketing'])
    expect(de.trackers.map((t) => t.name).sort()).toEqual(['Google Analytics 4', 'PostHog', 'Stripe', 'YouTube embeds'])
    expect(de.trackers.find((t) => t.name === 'Google Analytics 4')?.loader?.consentModeManaged).toBe(true)
    expect(de.consentMode.enabled).toBe(true)
    expect(de.banner.links).toEqual({ cookies: '/legal/cookies', privacy: '/legal/privacy' })
    expect(de.recording).toEqual({ enabled: true, endpoint: '/api/consent/records' })
    expect(de.cookie).toMatchObject({ name: 'pl-consent', sameSite: 'lax' })

    expect((await getConsentConfig(payload, { headers: new Headers({ 'cf-ipcountry': 'US' }) })).jurisdiction.model).toBe('opt-out')
    expect((await getConsentConfig(payload, {})).jurisdiction).toEqual({ country: null, model: 'opt-in' })
  })

  test('serves GET /api/consent/config with cache headers', async () => {
    const res = await call('/consent/config', { headers: { 'x-vercel-ip-country': 'FR' } })
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toContain('s-maxage')
    expect(res.headers.get('etag')).toMatch(/opt-in/)
    const body = (await res.json()) as ConsentConfig & { recordingMode?: string }
    expect(body.jurisdiction.country).toBe('FR')
    expect(body.recordingMode).toBeUndefined()
  })
})

describe('records', () => {
  test('validates bodies, rejects stale policy versions and stores decisions without an IP', async () => {
    resetRateLimits()
    const cfg = await getConsentConfig(payload, {})

    expect((await call('/consent/records', { body: { consentId: 'nope' }, method: 'POST' })).status).toBe(400)
    expect(
      (
        await call('/consent/records', {
          body: { consentId: uuid, decisions: { analytics: true }, source: 'banner', versions: { ...cfg.versions, policyVersion: '00000000' } },
          method: 'POST',
        })
      ).status,
    ).toBe(409)

    const ok = await call('/consent/records', {
      body: {
        consentId: uuid,
        decisions: { analytics: true, bogus: true, marketing: false, necessary: true },
        locale: 'en',
        source: 'banner',
        versions: cfg.versions,
      },
      headers: { 'user-agent': 'Mozilla/5.0 Chrome/120.0', 'x-forwarded-for': '203.0.113.9', 'x-vercel-ip-country': 'DE' },
      method: 'POST',
    })
    expect(ok.status).toBe(201)

    const records = await payload.find({ collection: 'consent-records', overrideAccess: true })
    expect(records.totalDocs).toBe(1)
    const record = records.docs[0]!
    expect(record.decisions).toEqual({ analytics: true, marketing: false })
    expect(record.grantedCategories).toEqual(['analytics'])
    expect(record.country).toBe('DE')
    expect(record.model).toBe('opt-in')
    expect(record.userAgentFamily).toBeFalsy()
    expect(JSON.stringify(record)).not.toContain('203.0.113.9')
  })

  test('cannot be created or read through the collection access', async () => {
    await expect(
      payload.create({ collection: 'consent-records', data: { consentId: uuid, decisions: {}, source: 'api' } as never, overrideAccess: false }),
    ).rejects.toThrow()
    await expect(payload.find({ collection: 'consent-records', overrideAccess: false, user: null })).rejects.toThrow(/not allowed/)
  })

  test('rate limits by client IP', async () => {
    resetRateLimits()
    const cfg = await getConsentConfig(payload, {})
    const body = { consentId: uuid, decisions: { analytics: false }, source: 'preferences', versions: cfg.versions }
    const statuses: number[] = []
    for (let i = 0; i < 22; i++) {
      statuses.push((await call('/consent/records', { body, headers: { 'x-forwarded-for': '198.51.100.7' }, method: 'POST' })).status)
    }
    expect(statuses.filter((s) => s === 201)).toHaveLength(20)
    expect(statuses.filter((s) => s === 429)).toHaveLength(2)
  })

  test('requires auth for GET /api/consent/records/me', async () => {
    expect((await call('/consent/records/me')).status).toBe(401)
  })

  test('purges records older than the retention period', async () => {
    const before = await payload.count({ collection: 'consent-records', overrideAccess: true })
    expect(before.totalDocs).toBeGreaterThan(0)
    const result = await purgeExpiredRecords(payload, getPluginOptions(payload), new Date(Date.now() + 40 * 30.4375 * 86_400_000))
    expect(result.deleted).toBe(before.totalDocs)
    expect((await payload.count({ collection: 'consent-records', overrideAccess: true })).totalDocs).toBe(0)
  })
})

describe('versions', () => {
  test('bumps the categories version on category changes and the documents version on republish', async () => {
    const before = (await payload.findGlobal({ slug: 'consent-settings', depth: 0, overrideAccess: true })).versions!
    await payload.create({
      collection: 'consent-categories',
      data: { description: 'Share buttons', key: 'social', label: 'Social', order: 9 },
      overrideAccess: true,
    })
    const afterCategory = (await payload.findGlobal({ slug: 'consent-settings', depth: 0, overrideAccess: true })).versions!
    expect(afterCategory.categoriesVersion).not.toBe(before.categoriesVersion)
    expect(afterCategory.documentsVersion).toBe(before.documentsVersion)
    expect(afterCategory.policyVersion).not.toBe(before.policyVersion)

    const privacy = await payload.find({ collection: 'legal-pages', overrideAccess: true, where: { kind: { equals: 'privacy' } } })
    await payload.update({
      collection: 'legal-pages',
      id: privacy.docs[0]!.id,
      data: { effectiveDate: '2030-01-01T00:00:00.000Z' },
      overrideAccess: true,
    })
    const afterDoc = (await payload.findGlobal({ slug: 'consent-settings', depth: 0, overrideAccess: true })).versions!
    expect(afterDoc.documentsVersion).not.toBe(afterCategory.documentsVersion)
    expect((await getConsentConfig(payload, {})).versions.policyVersion).toBe(afterDoc.policyVersion)
  })

  test('refuses to delete a category that trackers use', async () => {
    const analytics = await payload.find({ collection: 'consent-categories', overrideAccess: true, where: { key: { equals: 'analytics' } } })
    await expect(payload.delete({ collection: 'consent-categories', id: analytics.docs[0]!.id, overrideAccess: true })).rejects.toThrow(/used by/)
  })
})

describe('server helpers', () => {
  test('readConsent agrees with the browser store on the cookie', async () => {
    const cfg = await getConsentConfig(payload, { headers: new Headers({ 'x-vercel-ip-country': 'DE' }) })
    const cookie = encodeConsentCookie({
      cv: cfg.versions.categoriesVersion,
      d: { analytics: 1, functional: 0, marketing: 0, social: 0 },
      dv: cfg.versions.documentsVersion,
      id: uuid,
      j: 'in',
      pv: cfg.versions.policyVersion,
      s: 'b',
      t: Math.floor(Date.now() / 1000) - 10,
      tv: cfg.versions.trackersVersion,
      v: 1,
    })
    const fromHeader = readConsent(`a=1; pl-consent=${encodeURIComponent(cookie)}`, cfg)
    expect(fromHeader.status).toBe('decided')
    expect(fromHeader.has('analytics')).toBe(true)
    expect(fromHeader.has('marketing')).toBe(false)
    expect(fromHeader.has('necessary')).toBe(true)
    const fromNext = readConsent({ get: (n: string) => (n === 'pl-consent' ? { value: cookie } : undefined) }, cfg)
    expect(fromNext.decisions).toEqual(fromHeader.decisions)
    expect(readConsent(new Headers({ cookie: `pl-consent=${encodeURIComponent(cookie)}` }), cfg).status).toBe('decided')
    expect(readConsent(null, cfg).status).toBe('undecided')
    expect(decodeConsentCookie(cookie)?.id).toBe(uuid)
  })

  test('produces the dashboard overview', async () => {
    const overview = await getConsentOverview(payload)
    expect(overview.enabled).toBe(true)
    expect(overview.trackers).toBe(4)
    expect(overview.versions.policyVersion).toMatch(/^[0-9a-f]{8}$/)
    expect(overview.warnings.some((w) => w.includes('Social'))).toBe(true)
  })
})
