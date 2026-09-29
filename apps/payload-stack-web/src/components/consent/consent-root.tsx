'use client'

import { type ConsentConfig, ConsentProvider } from '@payload-solutions/consent-react'
import { type ReactNode, useEffect, useState } from 'react'

import { consentConfig } from '@/lib/consent'

import { ConsentBanner } from './consent-banner'
import { PostHogConsent } from './posthog-consent'

/**
 * The consent layer, the same one payload.solutions runs, fed a static config instead of the
 * plugin's endpoint because this site has no Payload behind it. The store reads the existing
 * decision from `document.cookie`, so pages stay static and the banner appears just after
 * hydration.
 *
 * The config is handed over only after mount, as payload.solutions' fetch does. Given it during
 * render, the provider builds its store at prerender time, where there is no cookie, so the
 * banner is baked into the static HTML; a visitor who has already chosen then hydrates to "no
 * banner", React abandons the mismatched markup, and a dead banner stays on screen.
 *
 * There is no `<ConsentModeScript>` because the site loads no Google tags.
 */
export function ConsentRoot({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<ConsentConfig>()
  // eslint-disable-next-line react-hooks/set-state-in-effect -- deliberately deferred past hydration, see above
  useEffect(() => setConfig(consentConfig), [])

  return (
    <ConsentProvider config={config}>
      {children}
      <PostHogConsent />
      <ConsentBanner />
    </ConsentProvider>
  )
}
