/**
 * Shared types for Payload Consent. The `ConsentConfig` shape is the contract between the Payload
 * plugin (which produces it at `GET /api/consent/config` or via the local API) and every client.
 */

export type ConsentModel = 'opt-in' | 'opt-out' | 'notice' | 'none'

export type ConsentModeSignal =
  | 'analytics_storage'
  | 'ad_storage'
  | 'ad_user_data'
  | 'ad_personalization'
  | 'functionality_storage'
  | 'personalization_storage'
  | 'security_storage'

export type ConsentCategory = {
  key: string
  label: string
  description: string
  required: boolean
  respectGPC: boolean
  defaultInOptOut: boolean
  consentModeSignals: ConsentModeSignal[]
}

export type TrackerKind = 'script' | 'cookie-only' | 'pixel' | 'iframe' | 'sdk'

export type TrackerLoader = {
  src?: string
  inline?: string
  strategy: 'afterDecision' | 'lazy'
  attributes?: Record<string, string>
  /** Google tags: load immediately and let Consent Mode gate the data, instead of withholding the script. */
  consentModeManaged: boolean
}

export type TrackerCookie = {
  name: string
  domain?: string
  durationText?: string
  storage: 'cookie' | 'localStorage' | 'sessionStorage' | 'indexedDB'
  description?: string
}

export type ConsentTracker = {
  id: string
  name: string
  vendor?: string
  vendorPrivacyUrl?: string
  categoryKey: string
  kind: TrackerKind
  purpose?: string
  cookies?: TrackerCookie[]
  loader?: TrackerLoader
}

export type ConsentVersions = {
  policyVersion: string
  categoriesVersion: string
  trackersVersion: string
  documentsVersion: string
}

export type ReconsentTrigger = 'documents' | 'categories' | 'trackers'

export type ConsentBannerConfig = {
  title: string
  description: string
  labels: {
    acceptAll: string
    rejectAll: string
    customize: string
    save: string
    close: string
    manage: string
    reloadNotice: string
    requiredBadge: string
  }
  position: 'bottom' | 'bottom-left' | 'bottom-right' | 'center'
  showRejectAll: boolean
  links: { privacy?: string; cookies?: string }
}

export type ConsentConfig = {
  enabled: boolean
  versions: ConsentVersions
  jurisdiction: { country: string | null; model: ConsentModel }
  categories: ConsentCategory[]
  trackers: ConsentTracker[]
  banner: ConsentBannerConfig
  reconsent: { on: ReconsentTrigger[]; expiresAfterMonths: number }
  recording: { enabled: boolean; endpoint: string }
  consentMode: { enabled: boolean; adsDataRedaction: boolean; urlPassthrough: boolean; waitForUpdateMs: number }
  cookie: { name: string; maxAgeDays: number; domain?: string; sameSite: 'lax' | 'strict' }
  locale: string
}

export type ConsentSource = 'banner' | 'preferences' | 'api' | 'gpc' | 'withdraw' | 'implicit'

/** Compact cookie payload, base64url-encoded JSON. Field names are short on purpose. */
export type ConsentCookieV1 = {
  v: 1
  id: string
  d: Record<string, 0 | 1>
  t: number
  pv: string
  cv: string
  tv: string
  dv: string
  j: 'in' | 'out' | 'notice' | 'none'
  s: 'b' | 'p' | 'a' | 'g' | 'w' | 'i'
}

export type ConsentStatus = 'undecided' | 'decided' | 'stale'
export type RepromptReason = null | 'expired' | ReconsentTrigger

export type ConsentExpr = string | { and: ConsentExpr[] } | { or: ConsentExpr[] } | { not: ConsentExpr }

export type ConsentState = {
  status: ConsentStatus
  model: ConsentModel
  /** Effective decisions for non-required categories. Required categories are always granted and not listed. */
  decisions: Record<string, boolean>
  /** Working copy edited in the preferences dialog; committed by `save()`. */
  draft: Record<string, boolean>
  ui: 'banner' | 'preferences' | 'closed'
  repromptReason: RepromptReason
  gpc: boolean
  needsReload: boolean
  consentId: string
  decidedAt: number | null
  source: ConsentSource | null
}

export type ConsentRecordInput = {
  consentId: string
  decisions: Record<string, boolean>
  versions: ConsentVersions
  source: ConsentSource
  locale?: string
}

export type StorageAdapter = {
  read(): string | null
  write(value: string, options: { maxAgeDays: number; domain?: string; sameSite: 'lax' | 'strict'; name: string }): void
  clear(options: { domain?: string; name: string }): void
}

export type ConsentStoreOptions = {
  config: ConsentConfig
  /** Cookie value read on the server (SSR) or omitted to read from `storage`. */
  initialCookie?: string | null
  storage?: StorageAdapter
  /** Override GPC detection (tests, SSR). Defaults to `navigator.globalPrivacyControl`. */
  gpc?: boolean
  now?: () => number
  /** Called after each committed decision; the default posts to `config.recording.endpoint`. */
  record?: (input: ConsentRecordInput) => void | Promise<void>
  /** Generates consent ids. Defaults to `crypto.randomUUID`. */
  uuid?: () => string
}

export type ConsentStore = {
  getState(): ConsentState
  subscribe(listener: (state: ConsentState) => void): () => void
  onChange(listener: (decisions: Record<string, boolean>, previous: Record<string, boolean>) => void): () => void
  has(expr: ConsentExpr): boolean
  isRequired(key: string): boolean
  acceptAll(): void
  rejectAll(): void
  withdraw(): void
  toggle(key: string, value?: boolean): void
  save(): void
  dismiss(): void
  open(ui: 'banner' | 'preferences'): void
  close(): void
  /** Re-read storage (cross-tab sync). */
  refresh(): void
  destroy(): void
}
