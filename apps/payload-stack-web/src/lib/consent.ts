import type { ConsentConfig } from '@payload-solutions/consent-react'

/*
  payloadstack.com has no Payload instance, so what payload.solutions keeps under Privacy in its
  admin lives here: the company behind the site, the processors, and the consent config the
  banner runs on. The legal pages render their cookie and recipient tables from these same
  objects, so the published policy cannot drift from what the site actually loads.

  Changing a legal page? Bump LEGAL_EFFECTIVE_DATE: it is the documents version, so everyone who
  already chose is asked again. Adding or removing a category bumps CATEGORIES_VERSION.
*/

export const LEGAL_EFFECTIVE_DATE = '2026-09-29'
const CATEGORIES_VERSION = '2026-09-29'
const TRACKERS_VERSION = '2026-09-29'

/** Same controller as payload.solutions (see its consentPlugin seed). */
export const COMPANY = {
  name: 'Payload Stack',
  legalName: 'Fortbit d.o.o.',
  address: 'Gradiščak 31A, 40313, Gradiščak, Croatia',
  email: 'hello@payload.solutions',
  url: 'https://fortbit.hr',
  site: 'https://www.payloadstack.com',
  governingLaw: 'Croatia',
} as const

export function formatLegalDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

export interface Processor {
  name: string
  legalName: string
  role: 'Processor' | 'Controller'
  purpose: string
  data: string
  country: string
  transferBasis: string
  privacyUrl: string
}

/** Everyone who receives personal data from the site. Taken from plugin-consent's presets. */
export const PROCESSORS: Processor[] = [
  {
    name: 'PostHog (EU Cloud)',
    legalName: 'PostHog Inc.',
    role: 'Processor',
    purpose: 'Product analytics hosted in the EU, only where analytics consent is given.',
    data: 'usage, technical',
    country: 'DE',
    transferBasis: 'Standard Contractual Clauses',
    privacyUrl: 'https://posthog.com/privacy',
  },
  {
    name: 'Vercel',
    legalName: 'Vercel Inc.',
    role: 'Processor',
    purpose: 'Website hosting, edge network and request logs.',
    data: 'technical',
    country: 'US',
    transferBasis: 'Standard Contractual Clauses',
    privacyUrl: 'https://vercel.com/legal/privacy-policy',
  },
]

const CONSENT_COOKIE = 'pl-consent'
const CONSENT_MONTHS = 6
const posthogToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN || '<project-token>'

/**
 * The client config the banner runs on, in the shape plugin-consent serves from
 * `/api/consent/config`. Opt-in for everyone: there is no server to resolve a jurisdiction from
 * the CDN country header, and the controller is in the EU anyway. Recording is off because there
 * is no Payload to keep the records; the choice lives only in the visitor's cookie.
 */
export const consentConfig: ConsentConfig = {
  enabled: true,
  versions: {
    policyVersion: `${LEGAL_EFFECTIVE_DATE}.${CATEGORIES_VERSION}.${TRACKERS_VERSION}`,
    categoriesVersion: CATEGORIES_VERSION,
    trackersVersion: TRACKERS_VERSION,
    documentsVersion: LEGAL_EFFECTIVE_DATE,
  },
  jurisdiction: { country: null, model: 'opt-in' },
  // Only the categories the site uses: a Marketing switch with nothing behind it tells the
  // visitor nothing.
  categories: [
    {
      key: 'necessary',
      label: 'Necessary',
      description: 'Required for the site to work: remembering your consent choice and your theme. Always on.',
      required: true,
      respectGPC: false,
      defaultInOptOut: true,
      consentModeSignals: ['security_storage'],
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
  ],
  trackers: [
    {
      id: 'consent',
      name: 'Consent choice',
      vendor: COMPANY.name,
      categoryKey: 'necessary',
      kind: 'cookie-only',
      purpose: 'Remembers the choice you made in this banner, so it is not shown on every page.',
      cookies: [
        {
          name: CONSENT_COOKIE,
          storage: 'cookie',
          durationText: `${CONSENT_MONTHS} months`,
          description: 'Your consent decision per category and the policy versions it applies to.',
        },
      ],
    },
    {
      id: 'theme',
      name: 'Theme preference',
      vendor: COMPANY.name,
      categoryKey: 'necessary',
      kind: 'cookie-only',
      purpose: 'Remembers light or dark mode when you switch it in the footer.',
      cookies: [
        {
          name: 'ps-theme',
          storage: 'localStorage',
          durationText: 'Until cleared',
          description: 'Set only when you use the theme switch.',
        },
      ],
    },
    {
      // Initialised in instrumentation-client.ts, so an `sdk` tracker: declared here for the
      // banner and the cookie policy, gated in code by PostHogConsent.
      id: 'posthog-eu',
      name: 'PostHog (EU Cloud)',
      vendor: 'PostHog Inc.',
      vendorPrivacyUrl: 'https://posthog.com/privacy',
      categoryKey: 'analytics',
      kind: 'sdk',
      purpose:
        'Product analytics hosted in the EU. Initialised by the application code; capture only starts once the analytics category is granted.',
      cookies: [
        {
          name: `ph_${posthogToken}_posthog`,
          storage: 'cookie',
          durationText: '12 months',
          description: 'Distinct id and session information.',
        },
      ],
    },
  ],
  banner: {
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
    position: 'bottom-left',
    showRejectAll: true,
    links: { privacy: '/legal/privacy', cookies: '/legal/cookies' },
  },
  reconsent: { on: ['documents', 'categories'], expiresAfterMonths: CONSENT_MONTHS },
  recording: { enabled: false, endpoint: '' },
  consentMode: { enabled: false, adsDataRedaction: false, urlPassthrough: false, waitForUpdateMs: 500 },
  cookie: { name: CONSENT_COOKIE, maxAgeDays: Math.round(CONSENT_MONTHS * 30.4375), sameSite: 'lax' },
  locale: 'en',
}
