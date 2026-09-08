import { ConsentModeScript, ConsentProvider } from '@payload-solutions/consent-react'
import { consentCookieValue, gpcFromHeaders } from '@payload-solutions/consent-react/next'
import { getConsentConfig } from '@payload-solutions/plugin-consent/server'
import { cookies, headers } from 'next/headers'
import type { ReactNode } from 'react'

import { ConsentBanner } from './consent-banner'
import { getPayloadClient } from '@/lib/payload'

/**
 * The consent layer, in two pieces, because one of them has to be in `<head>`.
 *
 * `getConsentConfig` goes through the local API — no HTTP request to your own server — and its
 * result is cached in process for 30 seconds per locale and invalidated the moment an editor saves,
 * so rendering both components costs one query, not two.
 */

/** Reads the banner config and the visitor's existing decision, for either half. */
async function load() {
  const payload = await getPayloadClient()
  const requestHeaders = await headers()
  const config = await getConsentConfig(payload, { headers: requestHeaders })
  return {
    config,
    cookie: consentCookieValue(await cookies(), config.cookie.name),
    gpc: gpcFromHeaders(requestHeaders),
  }
}

/**
 * The Google Consent Mode `default` call, computed from the cookie already in the request.
 *
 * It has to be in `<head>` and before any Google tag, or Google's tags run one page view before
 * your defaults arrive. Renders nothing when Consent Mode is switched off in the admin.
 */
export async function ConsentHead() {
  const { config, cookie, gpc } = await load()
  return <ConsentModeScript config={config} cookie={cookie} gpc={gpc} />
}

/**
 * The consent store, the gated third-party scripts and the banner.
 *
 * Passing the request cookie as `initialCookie` is what makes the first client render identical to
 * the server one: no flash of a banner that should not be there, and no hydration warning.
 */
export async function ConsentRoot({ children }: { children: ReactNode }) {
  const { config, cookie } = await load()
  return (
    <ConsentProvider config={config} initialCookie={cookie}>
      {children}
      <ConsentBanner />
    </ConsentProvider>
  )
}
