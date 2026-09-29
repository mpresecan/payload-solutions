'use client'

import { ConsentProvider } from '@payload-solutions/consent-react'
import type { ReactNode } from 'react'

import { consentConfig } from '@/lib/consent'

import { ConsentBanner } from './consent-banner'
import { PostHogConsent } from './posthog-consent'

/**
 * The consent layer, the same one payload.solutions runs, fed a static config instead of the
 * plugin's endpoint because this site has no Payload behind it. The store reads the existing
 * decision from `document.cookie`, so pages stay static and the banner appears just after
 * hydration.
 *
 * There is no `<ConsentModeScript>` because the site loads no Google tags.
 */
export function ConsentRoot({ children }: { children: ReactNode }) {
  return (
    <ConsentProvider config={consentConfig}>
      {children}
      <PostHogConsent />
      <ConsentBanner />
    </ConsentProvider>
  )
}
