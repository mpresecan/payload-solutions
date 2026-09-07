import type { Access, CollectionSlug, Field, GlobalSlug } from 'payload'

import type { ConsentModel, JurisdictionOverride } from '@payload-solutions/consent-core'

/** Slugs are typed against the host's generated types so the local API accepts them; the plugin casts at the boundary. */
export type ConsentPluginSlugs = {
  settings: GlobalSlug
  categories: CollectionSlug
  trackers: CollectionSlug
  records: CollectionSlug
  legalPages: CollectionSlug
  processors: CollectionSlug
  audits: CollectionSlug
}
export type ConsentPluginSlugInput = Partial<Record<keyof ConsentPluginSlugs, string>>

/** Loosely typed document from the local API; the plugin does not know the host's generated types. */
export type AnyDoc = Record<string, any>

export type CompanyInfo = {
  /** Trading / product name shown to visitors. */
  name: string
  legalName: string
  address: string
  email: string
  url?: string
  /** Countries or regions the documents are written for, e.g. ['EEA', 'GB']. Free text is accepted. */
  jurisdictions?: string[]
  governingLaw?: string
  dpo?: { name?: string; email: string } | false
}

/** How a recipient acts on the personal data. Getting this wrong is the classic disclosure error. */
export type ProcessorRole = 'processor' | 'sub-processor' | 'independent-controller' | 'joint-controller'

/** Chapter V basis for sending data outside the exporter's jurisdiction. */
export type TransferMechanism = 'none' | 'adequacy' | 'dpf' | 'scc' | 'bcr' | 'derogation'

export type ProcessorPresetKey =
  | 'vercel'
  | 'aws'
  | 'cloudflare'
  | 'mongodb-atlas'
  | 'neon'
  | 'supabase'
  | 'railway'
  | 'digitalocean'
  | 'hetzner'
  | 'resend'
  | 'postmark'
  | 'sendgrid'
  | 'stripe'
  | 'paddle'
  | 'sentry'
  | 'posthog'
  | 'posthog-eu'
  | 'ga4'
  | 'google-workspace'
  | 'intercom'
  | 'crisp'
  | 'slack'
  | 'openai'
  | 'anthropic'
  | 'uploadthing'
  | 'cloudinary'
  | 'better-stack'
  | 'github'

export type ProcessorPresetOptions = { key: ProcessorPresetKey; overrides?: Record<string, unknown> }

export type TrackerPresetKey =
  | 'posthog'
  | 'posthog-eu'
  | 'ga4'
  | 'gtm'
  | 'meta-pixel'
  | 'linkedin-insight'
  | 'hotjar'
  | 'clarity'
  | 'intercom'
  | 'crisp'
  | 'youtube'
  | 'vimeo'
  | 'google-maps'
  | 'stripe'
  | 'vercel-analytics'
  | 'umami'
  | 'plausible'

export type TrackerPresetOptions = { key: TrackerPresetKey; vars?: Record<string, string>; enabled?: boolean }

export type SeedOptions = {
  company?: CompanyInfo
  locale?: string
  /** Seed the four default categories when the collection is empty. Default true. */
  categories?: boolean
  /** Presets (or full tracker documents) to create when the trackers collection is empty. */
  trackers?: Array<TrackerPresetKey | TrackerPresetOptions>
  /** Seed privacy, terms and cookie policy when legal pages are enabled and empty. Default true when `company` is given. */
  legalPages?: boolean
  /** Which documents to seed. Default all five (or all three when processors are off). */
  documents?: Array<'privacy' | 'terms' | 'cookies' | 'subprocessors' | 'dpa'>
  /** Processors to create when the processors collection is empty. */
  processors?: Array<ProcessorPresetKey | ProcessorPresetOptions>
}

export type ConsentPluginOptions = {
  /** Set false to register nothing (useful for feature flags). Default true. */
  enabled?: boolean
  /** Endpoint prefix under `/api`. Default `/consent`. */
  basePath?: string
  slugs?: ConsentPluginSlugInput
  /**
   * Auth collection used to link consent records to logged-in users and to gate management access.
   * Default `'users'`. Set false to disable user linking entirely.
   */
  usersSlug?: string | false
  /** Enable the legal pages collection (privacy, terms, cookies…). Default true. */
  legalPages?: boolean
  /**
   * Enable the processor register: the recipients you disclose under GDPR Art. 13(1)(e), the
   * transfers under Art. 13(1)(f), and the sub-processor list your own customers rely on under
   * Art. 28(2). Default true.
   */
  processors?: boolean
  /**
   * Enable the stored legal audits collection, so `payload-consent scan` can write its report
   * where non-developers can read it. Admin-only, never public. Default true.
   */
  audits?: boolean
  /** Who may manage consent settings, categories, trackers and read records. Default: any authenticated user. */
  access?: { manage?: Access }
  cookie?: { name?: string; domain?: string; sameSite?: 'lax' | 'strict' }
  jurisdiction?: {
    headers?: string[]
    regionHeaders?: string[]
    overrides?: JurisdictionOverride[]
    fallback?: ConsentModel
    /** Trust `x-forwarded-for` for rate limiting. Default true. */
    trustProxy?: boolean
  }
  recording?: {
    mode?: 'none' | 'anonymous' | 'linked'
    retentionMonths?: number
    rateLimitPerMinute?: number
    implicit?: boolean
    userAgent?: boolean
  }
  /** Origins allowed to read the config endpoint and post records from another host (headless frontends). */
  allowedOrigins?: string[]
  seed?: false | SeedOptions
  admin?: { group?: string; dashboardWidget?: boolean }
  jobs?: { purge?: boolean | { cron?: string; queue?: string } }
  /** Extra fields appended to the trackers collection (e.g. tenant relationships). */
  trackerFields?: Field[]
  /** Extra fields appended to legal pages. */
  legalPageFields?: Field[]
  /** Extra fields appended to the processors collection. */
  processorFields?: Field[]
}

export type ResolvedConsentPluginOptions = Required<
  Omit<ConsentPluginOptions, 'seed' | 'trackerFields' | 'legalPageFields' | 'processorFields' | 'access'>
> & {
  slugs: ConsentPluginSlugs
  seed: false | SeedOptions
  access: { manage: Access }
  trackerFields: Field[]
  legalPageFields: Field[]
  processorFields: Field[]
  cookie: { name: string; domain?: string; sameSite: 'lax' | 'strict' }
  jurisdiction: Required<Omit<NonNullable<ConsentPluginOptions['jurisdiction']>, 'overrides'>> & {
    overrides: JurisdictionOverride[]
  }
  recording: Required<NonNullable<ConsentPluginOptions['recording']>>
  admin: Required<NonNullable<ConsentPluginOptions['admin']>>
  jobs: { purge: false | { cron?: string; queue?: string } }
}

export const DEFAULT_SLUGS: ConsentPluginSlugs = {
  settings: 'consent-settings' as GlobalSlug,
  categories: 'consent-categories' as CollectionSlug,
  trackers: 'consent-trackers' as CollectionSlug,
  records: 'consent-records' as CollectionSlug,
  legalPages: 'legal-pages' as CollectionSlug,
  processors: 'consent-processors' as CollectionSlug,
  audits: 'consent-audits' as CollectionSlug,
}

export function resolveOptions(options: ConsentPluginOptions = {}): ResolvedConsentPluginOptions {
  const manage: Access = options.access?.manage ?? (({ req }) => Boolean(req.user))
  const purge = options.jobs?.purge === false ? false : typeof options.jobs?.purge === 'object' ? options.jobs.purge : {}
  return {
    enabled: options.enabled ?? true,
    basePath: options.basePath ?? '/consent',
    slugs: { ...DEFAULT_SLUGS, ...(options.slugs as Partial<ConsentPluginSlugs>) },
    usersSlug: options.usersSlug === undefined ? 'users' : options.usersSlug,
    legalPages: options.legalPages ?? true,
    processors: options.processors ?? true,
    audits: options.audits ?? true,
    access: { manage },
    cookie: { name: options.cookie?.name ?? 'pl-consent', domain: options.cookie?.domain, sameSite: options.cookie?.sameSite ?? 'lax' },
    jurisdiction: {
      headers: options.jurisdiction?.headers ?? ['cf-ipcountry', 'x-vercel-ip-country', 'x-country', 'cloudfront-viewer-country'],
      regionHeaders: options.jurisdiction?.regionHeaders ?? ['x-vercel-ip-country-region', 'cloudfront-viewer-country-region'],
      overrides: options.jurisdiction?.overrides ?? [],
      fallback: options.jurisdiction?.fallback ?? 'opt-in',
      trustProxy: options.jurisdiction?.trustProxy ?? true,
    },
    recording: {
      mode: options.recording?.mode ?? 'anonymous',
      retentionMonths: options.recording?.retentionMonths ?? 36,
      rateLimitPerMinute: options.recording?.rateLimitPerMinute ?? 20,
      implicit: options.recording?.implicit ?? false,
      userAgent: options.recording?.userAgent ?? false,
    },
    allowedOrigins: options.allowedOrigins ?? [],
    seed: options.seed === false ? false : { categories: true, legalPages: true, ...(options.seed ?? {}) },
    admin: { group: options.admin?.group ?? 'Privacy', dashboardWidget: options.admin?.dashboardWidget ?? true },
    jobs: { purge },
    trackerFields: options.trackerFields ?? [],
    legalPageFields: options.legalPageFields ?? [],
    processorFields: options.processorFields ?? [],
  }
}
