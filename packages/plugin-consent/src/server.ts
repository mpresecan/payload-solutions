/**
 * Server-side helpers: build the client config from the local API, read the visitor's consent
 * from a Cookie header / Next.js cookies(), and query records.
 */
import type { Payload } from 'payload'

import {
  getCookieValue,
  resolveConsent,
  type ConsentConfig,
  type ResolvedConsent,
} from '@payload-solutions/consent-core'

import { getConsentConfig as buildConfig, type ConsentConfigWithMeta, type GetConsentConfigOptions } from './config.js'
import { getPluginOptions } from './index.js'
import { purgeExpiredRecords } from './jobs.js'
import type { AnyDoc, ResolvedConsentPluginOptions } from './types.js'

export type { ConsentConfigWithMeta, GetConsentConfigOptions }
export { computeVersions, recomputeVersions } from './versions.js'
export { invalidateConfigCache } from './config-cache.js'
export { buildLegalDocuments, markdownToLegalContent } from './seed/legal.js'
export { seedTrackers } from './seed/index.js'
export { purgeExpiredRecords }
/** Re-exported so server-side scripts need only one import. */
export { getPluginOptions }

/**
 * The full client config for this request. Pass `headers` (Next: `await headers()`) so the
 * jurisdiction is resolved from the CDN country header.
 */
export async function getConsentConfig(
  payload: Payload,
  input: GetConsentConfigOptions & { options?: ResolvedConsentPluginOptions } = {},
): Promise<ConsentConfig> {
  const { options, ...rest } = input
  const { recordingMode: _mode, ...config } = await buildConfig(payload, options ?? getPluginOptions(payload), rest)
  return config
}

type CookieSource =
  | string
  | null
  | undefined
  | { get(name: string): { value: string } | string | undefined | null }
  | { get(name: string): string | null }

/** Accepts a Cookie header string, Next.js `cookies()` (get → { value }), or a `Headers` object. */
export function cookieValue(source: CookieSource, name: string): string | null {
  if (!source) return null
  if (typeof source === 'string') return getCookieValue(source, name)
  const get = (source as { get(name: string): unknown }).get.bind(source)
  const got = get(name)
  if (got && typeof got === 'object' && 'value' in got) return String((got as { value: string }).value)
  if (typeof got === 'string') return got
  const header = get('cookie')
  return typeof header === 'string' ? getCookieValue(header, name) : null
}

/**
 * Resolves what the visitor has consented to, using the same logic as the browser store.
 * `cookies` may be a Cookie header string, Next.js `cookies()`, or `req.headers`.
 */
export function readConsent(cookies: CookieSource, config: ConsentConfig, gpc = false): ResolvedConsent & { has(key: string): boolean } {
  const raw = cookieValue(cookies, config.cookie.name)
  const resolved = resolveConsent(raw, config, { gpc })
  const required = new Set(config.categories.filter((c) => c.required).map((c) => c.key))
  return { ...resolved, has: (key: string) => required.has(key) || resolved.decisions[key] === true }
}

/** Public trackers + categories for rendering the cookie table outside the plugin's own components. */
export async function getCookieTableData(payload: Payload, input: GetConsentConfigOptions = {}) {
  const config = await getConsentConfig(payload, input)
  return { categories: config.categories, trackers: config.trackers }
}

/** Version and count summary used by the dashboard widget. */
export async function getConsentOverview(payload: Payload, options: ResolvedConsentPluginOptions = getPluginOptions(payload)) {
  const settings = (await payload.findGlobal({ slug: options.slugs.settings, depth: 0, overrideAccess: true })) as AnyDoc
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString()
  const [records, recent, trackers, categories] = (await Promise.all([
    payload.count({ collection: options.slugs.records, overrideAccess: true }),
    payload.find({
      collection: options.slugs.records,
      where: { createdAt: { greater_than: since } },
      limit: 2000,
      pagination: false,
      depth: 0,
      overrideAccess: true,
    }),
    payload.find({ collection: options.slugs.trackers, limit: 500, pagination: false, depth: 0, overrideAccess: true }),
    payload.find({ collection: options.slugs.categories, limit: 100, pagination: false, depth: 0, overrideAccess: true }),
  ])) as unknown as [{ totalDocs: number }, { docs: AnyDoc[] }, { docs: AnyDoc[] }, { docs: AnyDoc[] }]
  const perCategory: Record<string, number> = {}
  for (const c of categories.docs) perCategory[String(c.key)] = 0
  for (const r of recent.docs) {
    for (const k of (r.grantedCategories as string[] | undefined) ?? []) perCategory[k] = (perCategory[k] ?? 0) + 1
  }
  const warnings: string[] = []
  for (const t of trackers.docs) {
    if (!t.vendorPrivacyUrl) warnings.push(`"${String(t.name)}" has no vendor privacy policy link.`)
  }
  const usedCategories = new Set(trackers.docs.map((t) => (typeof t.category === 'object' && t.category ? String((t.category as { id: unknown }).id) : String(t.category))))
  for (const c of categories.docs) {
    if (!c.required && !usedCategories.has(String(c.id))) warnings.push(`Category "${String(c.label)}" has no trackers.`)
  }
  return {
    enabled: settings.enabled !== false,
    versions: (settings.versions ?? {}) as Record<string, string | undefined>,
    totalRecords: records.totalDocs,
    last30Days: recent.docs.length,
    grantedLast30Days: perCategory,
    trackers: trackers.docs.length,
    trackersWithCookies: trackers.docs.filter((t) => Array.isArray(t.cookies) && t.cookies.length > 0).length,
    warnings,
  }
}
