import { decodeConsentCookie, shortToSource } from './codec.js'
import type { ConsentConfig, ConsentCookieV1, ConsentState, RepromptReason } from './types.js'

const MONTH_SECONDS = 30.4375 * 86400

export type ResolvedConsent = Pick<
  ConsentState,
  'status' | 'model' | 'decisions' | 'repromptReason' | 'consentId' | 'decidedAt' | 'source' | 'gpc'
> & { cookie: ConsentCookieV1 | null }

export function nonRequiredKeys(config: ConsentConfig): string[] {
  return config.categories.filter((c) => !c.required).map((c) => c.key)
}

/** Decisions a visitor gets before choosing, under the resolved model, with GPC applied. */
export function defaultDecisions(config: ConsentConfig, gpc: boolean): Record<string, boolean> {
  const model = config.jurisdiction.model
  const out: Record<string, boolean> = {}
  for (const c of config.categories) {
    if (c.required) continue
    let granted = model === 'opt-in' ? false : model === 'opt-out' ? c.defaultInOptOut : true
    if (gpc && c.respectGPC && model !== 'opt-in') granted = false
    out[c.key] = granted
  }
  return out
}

function repromptReasonFor(cookie: ConsentCookieV1, config: ConsentConfig, now: number): RepromptReason {
  const expiresAt = cookie.t + config.reconsent.expiresAfterMonths * MONTH_SECONDS
  if (now >= expiresAt) return 'expired'
  const on = config.reconsent.on
  if (on.includes('documents') && cookie.dv !== config.versions.documentsVersion) return 'documents'
  if (on.includes('categories') && cookie.cv !== config.versions.categoriesVersion) return 'categories'
  if (on.includes('trackers') && cookie.tv !== config.versions.trackersVersion) return 'trackers'
  return null
}

/**
 * Pure function: cookie + config + GPC → initial consent state. Used identically on the server
 * (`readConsent`) and in the browser store, so both sides agree on what is granted.
 */
export function resolveConsent(
  rawCookie: string | null | undefined,
  config: ConsentConfig,
  options: { gpc?: boolean; now?: number; uuid?: () => string } = {},
): ResolvedConsent {
  const gpc = options.gpc ?? false
  const now = options.now ?? Math.floor(Date.now() / 1000)
  const uuid = options.uuid ?? (() => globalThis.crypto?.randomUUID?.() ?? fallbackUuid())
  const cookie = decodeConsentCookie(rawCookie)
  const model = config.jurisdiction.model
  const defaults = defaultDecisions(config, gpc)

  if (!cookie) {
    return { status: 'undecided', model, decisions: defaults, repromptReason: null, consentId: uuid(), decidedAt: null, source: null, gpc, cookie: null }
  }

  // Known keys from the cookie, new categories at their model default, dropped categories ignored.
  const decisions: Record<string, boolean> = {}
  for (const key of nonRequiredKeys(config)) {
    decisions[key] = key in cookie.d ? cookie.d[key] === 1 : defaults[key]!
  }
  if (gpc && model !== 'opt-in') {
    for (const c of config.categories) if (!c.required && c.respectGPC) decisions[c.key] = false
  }

  const reason = repromptReasonFor(cookie, config, now)
  return {
    status: reason ? 'stale' : 'decided',
    model,
    decisions,
    repromptReason: reason,
    consentId: cookie.id,
    decidedAt: cookie.t,
    source: shortToSource(cookie.s),
    gpc,
    cookie,
  }
}

export function fallbackUuid(): string {
  // RFC 4122 v4 from Math.random — only used where crypto.randomUUID is unavailable (very old runtimes).
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

/** Convenience for server code: is `key` granted for this cookie under this config? */
export function hasConsent(rawCookie: string | null | undefined, config: ConsentConfig, key: string, gpc = false): boolean {
  const category = config.categories.find((c) => c.key === key)
  if (!category) return false
  if (category.required) return true
  const resolved = resolveConsent(rawCookie, config, { gpc })
  return resolved.decisions[key] === true
}
