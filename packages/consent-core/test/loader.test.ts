import { describe, expect, it } from 'vitest'

import { attachLoader, createConsentStore, createTestConfig, memoryStorage, type ConsentTracker } from '../src/index.js'

const trackers: ConsentTracker[] = [
  { id: 'ph', name: 'PostHog', categoryKey: 'analytics', kind: 'script', loader: { src: 'https://eu.i.posthog.com/static/array.js', strategy: 'afterDecision', consentModeManaged: false } },
  { id: 'gtm', name: 'GTM', categoryKey: 'marketing', kind: 'script', loader: { src: 'https://www.googletagmanager.com/gtm.js?id=GTM-X', strategy: 'afterDecision', consentModeManaged: true } },
  { id: 'yt', name: 'YouTube', categoryKey: 'functional', kind: 'iframe' },
]

describe('script loader', () => {
  it('loads Consent-Mode-managed scripts immediately and gated scripts only after consent, exactly once', () => {
    document.head.innerHTML = ''
    const store = createConsentStore({ config: createTestConfig({ trackers }), storage: memoryStorage(), gpc: false })
    const detach = attachLoader(store, trackers, { nonce: 'n0nce' })
    expect(document.querySelectorAll('script[data-consent-tracker]').length).toBe(1)
    expect(document.querySelector('script[data-consent-tracker="gtm"]')?.getAttribute('nonce')).toBe('n0nce')

    store.acceptAll()
    expect(document.querySelector('script[data-consent-tracker="ph"]')).toBeTruthy()
    store.acceptAll()
    expect(document.querySelectorAll('script[data-consent-tracker="ph"]').length).toBe(1)
    // iframes are never injected by the loader
    expect(document.querySelector('script[data-consent-tracker="yt"]')).toBeNull()
    detach()
  })
})
