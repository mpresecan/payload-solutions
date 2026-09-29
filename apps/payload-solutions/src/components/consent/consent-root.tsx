'use client'

import { ConsentProvider } from '@payload-solutions/consent-react'
import type { ReactNode } from 'react'

import { ConsentBanner } from './consent-banner'
import { PostHogConsent } from './posthog-consent'

/**
 * The consent layer for the frontend.
 *
 * The provider fetches its config from the plugin's endpoint instead of receiving it from the
 * layout: reading cookies and headers in the root layout would opt every page out of static
 * rendering, and the homepage and docs are prerendered. The endpoint still resolves the visitor's
 * jurisdiction from the CDN country header, and the store reads the existing decision from
 * `document.cookie`, so the only cost is that the banner appears just after hydration.
 *
 * There is no `<ConsentModeScript>` because the site loads no Google tags.
 */
export function ConsentRoot({ children }: { children: ReactNode }) {
  return (
    <ConsentProvider configUrl="/api/consent/config">
      {children}
      <PostHogConsent />
      <ConsentBanner />
    </ConsentProvider>
  )
}
