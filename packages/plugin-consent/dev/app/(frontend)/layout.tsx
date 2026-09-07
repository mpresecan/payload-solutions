import type { ReactNode } from 'react'

import config from '@payload-config'
import { ConsentModeScript, ConsentProvider } from '@payload-solutions/consent-react'
import { getConsentConfig } from '@payload-solutions/plugin-consent/server'
import { cookies, headers } from 'next/headers'
import { getPayload } from 'payload'

import { ConsentBanner } from './components/consent-banner.js'
import { ConsentSettingsLink } from './components/consent-settings-link.js'
import './globals.css'

export const dynamic = 'force-dynamic'

export default async function FrontendLayout({ children }: { children: ReactNode }) {
  const payload = await getPayload({ config })
  const consent = await getConsentConfig(payload, { headers: await headers() })
  const cookie = (await cookies()).get(consent.cookie.name)?.value ?? null

  return (
    <html lang="en">
      <head>
        <ConsentModeScript config={consent} cookie={cookie} />
      </head>
      <body>
        <ConsentProvider config={consent} initialCookie={cookie}>
          <header className="site-header">
            <a href="/">Payload Consent dev</a>
            <nav>
              <a href="/legal/privacy">Privacy</a>
              <a href="/legal/cookies">Cookies</a>
              <a href="/legal/terms">Terms</a>
              <a href="/admin">Admin</a>
            </nav>
          </header>
          <main className="site-main">{children}</main>
          <footer className="site-footer">
            <span>
              Jurisdiction: {consent.jurisdiction.country ?? 'unknown'} → {consent.jurisdiction.model}
            </span>
            <ConsentSettingsLink />
          </footer>
          <ConsentBanner />
        </ConsentProvider>
      </body>
    </html>
  )
}
