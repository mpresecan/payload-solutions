import type { ConsentBannerConfig, ConsentCategory, ConsentConfig } from './types.js'

/** The four conventional categories with their default Consent Mode mapping. Seeded by the plugin. */
export const DEFAULT_CATEGORIES: ConsentCategory[] = [
  {
    key: 'necessary',
    label: 'Necessary',
    description: 'Required for the site to work: sign-in, security, remembering your consent choice. Always on.',
    required: true,
    respectGPC: false,
    defaultInOptOut: true,
    consentModeSignals: ['security_storage'],
  },
  {
    key: 'functional',
    label: 'Functional',
    description: 'Remember preferences such as language or region and enable embedded content.',
    required: false,
    respectGPC: false,
    defaultInOptOut: true,
    consentModeSignals: ['functionality_storage', 'personalization_storage'],
  },
  {
    key: 'analytics',
    label: 'Analytics',
    description: 'Help us understand how the site is used so we can improve it. Aggregated, never sold.',
    required: false,
    respectGPC: true,
    defaultInOptOut: true,
    consentModeSignals: ['analytics_storage'],
  },
  {
    key: 'marketing',
    label: 'Marketing',
    description: 'Used to measure and personalise advertising across sites.',
    required: false,
    respectGPC: true,
    defaultInOptOut: true,
    consentModeSignals: ['ad_storage', 'ad_user_data', 'ad_personalization'],
  },
]

export const DEFAULT_BANNER: ConsentBannerConfig = {
  title: 'Your privacy choices',
  description:
    'We use cookies and similar technologies. Necessary ones keep the site working; the rest only run with your consent. You can change your choice at any time.',
  labels: {
    acceptAll: 'Accept all',
    rejectAll: 'Reject all',
    customize: 'Customize',
    save: 'Save preferences',
    close: 'Close',
    manage: 'Cookie settings',
    reloadNotice: 'Some services were switched off. Reload the page to apply your choice fully.',
    requiredBadge: 'Always on',
  },
  position: 'bottom',
  showRejectAll: true,
  links: {},
}

/** A complete config for tests and local development. */
export function createTestConfig(overrides: Partial<ConsentConfig> = {}): ConsentConfig {
  return {
    enabled: true,
    versions: { policyVersion: 'p1', categoriesVersion: 'c1', trackersVersion: 't1', documentsVersion: 'd1' },
    jurisdiction: { country: 'DE', model: 'opt-in' },
    categories: DEFAULT_CATEGORIES,
    trackers: [],
    banner: DEFAULT_BANNER,
    reconsent: { on: ['documents', 'categories'], expiresAfterMonths: 6 },
    recording: { enabled: false, endpoint: '/api/consent/records' },
    consentMode: { enabled: false, adsDataRedaction: false, urlPassthrough: false, waitForUpdateMs: 500 },
    cookie: { name: 'pl-consent', maxAgeDays: 183, sameSite: 'lax' },
    locale: 'en',
    ...overrides,
  }
}
