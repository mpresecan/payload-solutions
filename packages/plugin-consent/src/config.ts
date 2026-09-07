import type { Payload, PayloadRequest, TypedLocale } from 'payload'

import {
  DEFAULT_BANNER,
  DEFAULT_JURISDICTION_OVERRIDES,
  countryFromHeaders,
  lastOverride,
  resolveJurisdictionModel,
  type ConsentBannerConfig,
  type ConsentCategory,
  type ConsentConfig,
  type ConsentModeSignal,
  type ConsentModel,
  type ConsentTracker,
  type ConsentVersions,
  type JurisdictionOverride,
  type ReconsentTrigger,
  type TrackerCookie,
} from '@payload-solutions/consent-core'

import { cached } from './config-cache.js'
import type { AnyDoc, ResolvedConsentPluginOptions } from './types.js'
import { computeVersions } from './versions.js'

type HeaderSource = { get(name: string): string | null }
const STORAGE_KINDS = ['cookie', 'localStorage', 'sessionStorage', 'indexedDB']

export type GetConsentConfigOptions = {
  locale?: string
  /** Request headers used for jurisdiction detection. */
  headers?: HeaderSource | Record<string, string | string[] | undefined>
  /** Explicit country (overrides headers). */
  country?: string | null
  region?: string | null
  /** Explicit model (overrides detection; development previews). */
  model?: ConsentModel
  environment?: 'development' | 'production'
  req?: PayloadRequest
}

const relId = (v: unknown): string => (typeof v === 'object' && v ? String((v as { id: unknown }).id) : String(v))

/** Everything except the per-request jurisdiction, cached briefly per locale + environment. */
async function loadBase(payload: Payload, options: ResolvedConsentPluginOptions, locale: string | undefined, environment: string, req?: PayloadRequest) {
  const { slugs } = options
  const common = { depth: 0, overrideAccess: true, req, ...(locale ? { locale: locale as unknown as TypedLocale } : {}) } as const

  const settings = (await payload.findGlobal({ slug: slugs.settings, ...common })) as AnyDoc
  const categoriesRes = (await payload.find({ collection: slugs.categories, sort: 'order', limit: 100, pagination: false, ...common })) as unknown as { docs: AnyDoc[] }
  const trackersRes = (await payload.find({
    collection: slugs.trackers,
    where: { and: [{ enabled: { equals: true } }, { environments: { contains: environment } }] },
    limit: 500,
    pagination: false,
    ...common,
  })) as unknown as { docs: AnyDoc[] }

  const categoryKeyById = new Map<string, string>()
  const categories: ConsentCategory[] = categoriesRes.docs.map((d) => {
    categoryKeyById.set(String(d.id), String(d.key))
    return {
      key: String(d.key),
      label: String(d.label ?? d.key),
      description: String(d.description ?? ''),
      required: Boolean(d.required),
      respectGPC: Boolean(d.respectGPC),
      defaultInOptOut: d.defaultInOptOut !== false,
      consentModeSignals: (Array.isArray(d.consentModeSignals) ? d.consentModeSignals : []) as ConsentModeSignal[],
    }
  })

  const trackers: ConsentTracker[] = trackersRes.docs.flatMap((d) => {
    const categoryKey = categoryKeyById.get(relId(d.category))
    if (!categoryKey) return []
    const loaderDoc = (d.loader ?? {}) as Record<string, unknown>
    const kind = String(d.kind) as ConsentTracker['kind']
    const hasLoader = (kind === 'script' || kind === 'pixel') && (loaderDoc.src || loaderDoc.inlineCode)
    return [
      {
        id: String(d.id),
        name: String(d.name),
        vendor: d.vendor ? String(d.vendor) : undefined,
        vendorPrivacyUrl: d.vendorPrivacyUrl ? String(d.vendorPrivacyUrl) : undefined,
        categoryKey,
        kind,
        purpose: d.purpose ? String(d.purpose) : undefined,
        cookies: Array.isArray(d.cookies)
          ? (d.cookies as Array<Record<string, unknown>>).map((c) => ({
              name: String(c.name),
              domain: c.domain ? String(c.domain) : undefined,
              durationText: c.durationText ? String(c.durationText) : undefined,
              storage: (STORAGE_KINDS.includes(String(c.storage)) ? String(c.storage) : 'cookie') as TrackerCookie['storage'],
              description: c.description ? String(c.description) : undefined,
            }))
          : [],
        loader: hasLoader
          ? {
              src: loaderDoc.src ? String(loaderDoc.src) : undefined,
              inline: loaderDoc.inlineCode ? String(loaderDoc.inlineCode) : undefined,
              strategy: (loaderDoc.strategy as 'afterDecision' | 'lazy') ?? 'afterDecision',
              attributes: loaderDoc.attributes && typeof loaderDoc.attributes === 'object' ? (loaderDoc.attributes as Record<string, string>) : undefined,
              consentModeManaged: Boolean(loaderDoc.consentModeManaged),
            }
          : undefined,
      },
    ]
  })

  let versions = (settings.versions ?? null) as (ConsentVersions & { bumpedAt?: string }) | null
  if (!versions?.policyVersion) versions = { ...(await computeVersions(payload, options, req)) }

  const bannerDoc = (settings.banner ?? {}) as Record<string, unknown>
  const labelsDoc = (bannerDoc.labels ?? {}) as Record<string, unknown>
  const pageUrl = (page: unknown): string | undefined => {
    if (!page) return undefined
    if (typeof page === 'object' && 'slug' in page) return `/legal/${String((page as { slug: unknown }).slug)}`
    return undefined
  }
  // Relationship pages need a lookup when depth is 0.
  const resolvePage = async (ref: unknown) => {
    if (!ref || !options.legalPages) return undefined
    if (typeof ref === 'object') return pageUrl(ref)
    try {
      const page = (await payload.findByID({ collection: slugs.legalPages, id: ref as string, depth: 0, overrideAccess: true, req })) as AnyDoc
      return pageUrl(page)
    } catch {
      return undefined
    }
  }

  const banner: ConsentBannerConfig = {
    title: String(bannerDoc.title ?? DEFAULT_BANNER.title),
    description: String(bannerDoc.description ?? DEFAULT_BANNER.description),
    labels: {
      ...DEFAULT_BANNER.labels,
      ...Object.fromEntries(Object.entries(labelsDoc).filter(([, v]) => typeof v === 'string' && v)),
    } as ConsentBannerConfig['labels'],
    position: (bannerDoc.position as ConsentBannerConfig['position']) ?? DEFAULT_BANNER.position,
    showRejectAll: bannerDoc.showRejectAll !== false,
    links: {
      privacy: (await resolvePage(bannerDoc.privacyPage)) ?? (bannerDoc.privacyUrl ? String(bannerDoc.privacyUrl) : undefined),
      cookies: (await resolvePage(bannerDoc.cookiePage)) ?? (bannerDoc.cookieUrl ? String(bannerDoc.cookieUrl) : undefined),
    },
  }

  const consentModeDoc = (settings.consentMode ?? {}) as Record<string, unknown>
  const consentModeSetting = String(consentModeDoc.enabled ?? 'auto')
  const consentModeEnabled =
    consentModeSetting === 'on' || (consentModeSetting === 'auto' && trackers.some((t) => t.loader?.consentModeManaged))

  const recordingDoc = (settings.recording ?? {}) as Record<string, unknown>
  const recordingMode = String(recordingDoc.mode ?? options.recording.mode)
  const jurisdictionDoc = (settings.jurisdiction ?? {}) as Record<string, unknown>
  const overrides: JurisdictionOverride[] = [
    ...DEFAULT_JURISDICTION_OVERRIDES,
    ...options.jurisdiction.overrides,
    ...((Array.isArray(jurisdictionDoc.overrides) ? jurisdictionDoc.overrides : []) as Array<{ region: string; model: ConsentModel }>).map((o) => ({
      region: String(o.region),
      model: o.model,
    })),
  ]
  const expiresAfterMonths = Number(settings.expiresAfterMonths ?? 6) || 6

  return {
    enabled: settings.enabled !== false,
    versions: {
      policyVersion: versions.policyVersion,
      categoriesVersion: versions.categoriesVersion,
      trackersVersion: versions.trackersVersion,
      documentsVersion: versions.documentsVersion,
    },
    categories,
    trackers,
    banner,
    reconsent: {
      on: (Array.isArray(settings.reconsentOn) ? settings.reconsentOn : ['documents', 'categories']) as ReconsentTrigger[],
      expiresAfterMonths,
    },
    recording: { enabled: recordingMode !== 'none', endpoint: `/api${options.basePath}/records`, mode: recordingMode },
    consentMode: {
      enabled: consentModeEnabled,
      adsDataRedaction: consentModeDoc.adsDataRedaction !== false,
      urlPassthrough: Boolean(consentModeDoc.urlPassthrough),
      waitForUpdateMs: Number(consentModeDoc.waitForUpdateMs ?? 500) || 500,
    },
    cookie: {
      name: options.cookie.name,
      maxAgeDays: Math.round(expiresAfterMonths * 30.4375),
      domain: options.cookie.domain,
      sameSite: options.cookie.sameSite,
    },
    jurisdictionSettings: {
      resolution: String(jurisdictionDoc.resolution ?? 'header') as 'header' | 'manual' | 'none',
      fixed: jurisdictionDoc.fixed ? String(jurisdictionDoc.fixed) : null,
      fallback: (jurisdictionDoc.fallback as ConsentModel | undefined) ?? options.jurisdiction.fallback,
      overrides,
    },
  }
}

export type ConsentConfigWithMeta = ConsentConfig & { recordingMode: string }

/**
 * Assembles the client config for one request. Call from the endpoint, from a Server Component
 * (`getConsentConfig(payload, { headers: await headers() })`) or from tests.
 */
export async function getConsentConfig(
  payload: Payload,
  options: ResolvedConsentPluginOptions,
  input: GetConsentConfigOptions = {},
): Promise<ConsentConfigWithMeta> {
  const environment = input.environment ?? (process.env.NODE_ENV === 'production' ? 'production' : 'development')
  const locale = input.locale
  const base = await cached(`${locale ?? ''}|${environment}`, 30_000, () => loadBase(payload, options, locale, environment, input.req))

  let country: string | null = input.country ?? null
  let region: string | null = input.region ?? null
  if (!country && base.jurisdictionSettings.resolution === 'manual') country = base.jurisdictionSettings.fixed
  if (!country && base.jurisdictionSettings.resolution === 'header' && input.headers) {
    country = countryFromHeaders(input.headers, options.jurisdiction.headers)
    region = region ?? countryFromHeaders(input.headers, options.jurisdiction.regionHeaders)
  }
  const model =
    input.model ??
    (country === 'EEA'
      ? (lastOverride(base.jurisdictionSettings.overrides, 'EEA') ?? 'opt-in')
      : resolveJurisdictionModel({ country, region, overrides: base.jurisdictionSettings.overrides, fallback: base.jurisdictionSettings.fallback }))

  const { jurisdictionSettings: _omit, recording, ...rest } = base
  return {
    ...rest,
    recording: { enabled: recording.enabled, endpoint: recording.endpoint },
    recordingMode: recording.mode,
    jurisdiction: { country, model },
    locale: locale ?? 'en',
  }
}
