import type { ConsentCategory, ConsentConfig, ConsentModeSignal } from './types.js'

export const ALL_CONSENT_MODE_SIGNALS: ConsentModeSignal[] = [
  'analytics_storage',
  'ad_storage',
  'ad_user_data',
  'ad_personalization',
  'functionality_storage',
  'personalization_storage',
  'security_storage',
]

export type ConsentModeState = Record<ConsentModeSignal, 'granted' | 'denied'>

/**
 * Maps category decisions to Google Consent Mode v2 signals. A signal is granted when at least one
 * category that declares it is granted (required categories always count as granted).
 * `security_storage` is always granted: it covers fraud prevention and authentication.
 */
export function consentModeStateFrom(
  categories: ConsentCategory[],
  granted: (key: string) => boolean,
): ConsentModeState {
  const state = Object.fromEntries(ALL_CONSENT_MODE_SIGNALS.map((s) => [s, 'denied'])) as ConsentModeState
  for (const category of categories) {
    if (!(category.required || granted(category.key))) continue
    for (const signal of category.consentModeSignals) state[signal] = 'granted'
  }
  state.security_storage = 'granted'
  return state
}

type GtagWindow = Window & { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void }

function ensureGtag(): (...args: unknown[]) => void {
  const w = window as GtagWindow
  w.dataLayer = w.dataLayer || []
  if (typeof w.gtag !== 'function') {
    w.gtag = function gtag() {
      // eslint-disable-next-line prefer-rest-params
      w.dataLayer!.push(arguments)
    }
  }
  return w.gtag
}

/** Emits `gtag('consent', 'default', …)`. Must run before any Google tag; `<ConsentModeScript>` renders it inline. */
export function emitConsentModeDefault(state: ConsentModeState, config: ConsentConfig['consentMode']) {
  if (typeof window === 'undefined') return
  const gtag = ensureGtag()
  gtag('consent', 'default', { ...state, wait_for_update: config.waitForUpdateMs })
  if (config.adsDataRedaction) gtag('set', 'ads_data_redaction', true)
  if (config.urlPassthrough) gtag('set', 'url_passthrough', true)
}

export function emitConsentModeUpdate(state: ConsentModeState) {
  if (typeof window === 'undefined') return
  ensureGtag()('consent', 'update', state)
}

/**
 * Inline script source for the Consent Mode default, for rendering in `<head>` before any tag.
 * Pure string: safe to use in a Server Component with a CSP nonce.
 */
export function consentModeDefaultScript(state: ConsentModeState, config: ConsentConfig['consentMode']): string {
  const payload = JSON.stringify({ ...state, wait_for_update: config.waitForUpdateMs })
  const extras =
    (config.adsDataRedaction ? "gtag('set','ads_data_redaction',true);" : '') +
    (config.urlPassthrough ? "gtag('set','url_passthrough',true);" : '')
  // Idempotent: frameworks may render the inline script twice (SSR + hydration); only the first run emits.
  return `if(!window.__plConsentModeDefault){window.__plConsentModeDefault=1;window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('consent','default',${payload});${extras}}`
}
