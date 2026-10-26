import type { Metadata, Viewport } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { brands } from '@payload-solutions/brand'
import { FamilyBar } from '@payload-solutions/brand/family-bar'
import { ConsentRoot } from '@/components/consent/consent-root'
import { JsonLd, ORGANIZATION_ID, organizationLd } from '@payload-solutions/brand/json-ld'

import './globals.css'
import { CLIP_CDN } from '@payload-solutions/brand/clips'

const brand = brands.stack

export const metadata: Metadata = {
  metadataBase: new URL(brand.url),
  title: {
    default: brand.title,
    template: `%s | ${brand.name}`,
  },
  description: brand.description,
  applicationName: brand.name,
  keywords: [
    'Payload CMS',
    'SaaS boilerplate',
    'Next.js SaaS starter',
    'Better Auth',
    'Stripe subscriptions',
    'multi-tenant',
    'shadcn/ui',
    'create-payload-stack',
    'agentic development',
    'AI coding agents',
    'AGENTS.md',
    'Claude Code',
    'Codex',
    'Cursor',
    'MCP',
  ],
  openGraph: {
    type: 'website',
    siteName: brand.name,
    title: brand.tagline,
    description: brand.description,
    url: brand.url,
  },
  twitter: {
    card: 'summary_large_image',
    site: brand.twitter,
    creator: brand.twitter,
    title: brand.tagline,
    description: brand.description,
  },
  robots: { index: true, follow: true },
  alternates: { canonical: '/' },
}

export const viewport: Viewport = {
  // The site opens dark whatever the system says, so the browser chrome matches.
  themeColor: '#000000',
  width: 'device-width',
  initialScale: 1,
}

/**
 * Applies the theme before first paint. Dark is the default whatever the system prefers;
 * the toggle in the footer writes `ps-theme` = light | dark.
 */
const themeInitScript = `(function(){var t='dark';try{var s=localStorage.getItem('ps-theme');if(s==='light'||s==='dark'){t=s}}catch(e){}document.documentElement.setAttribute('data-theme',t)})();`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    /* data-brand picks this site's accent family (platinum) out of the shared token set. */
    <html
      lang="en"
      data-brand="stack"
      /* Next disables CSS smooth scrolling during route changes unless this is set. */
      data-scroll-behavior="smooth"
      data-theme="dark"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        {/* The demo videos and the launch film stream from here; warm the connection early. */}
        <link rel="preconnect" href={CLIP_CDN} />
      </head>
      <body className="min-h-dvh bg-bg text-fg antialiased">
        {/* The product as software for search engines: free, MIT, published by Payload Solutions. */}
        <JsonLd
          data={{
            '@context': 'https://schema.org',
            '@graph': [
              {
                '@type': 'SoftwareApplication',
                '@id': `${brand.url}/#software`,
                name: brand.name,
                description: brand.description,
                url: brand.url,
                applicationCategory: 'DeveloperApplication',
                operatingSystem: 'Any',
                license: `${brand.github}/blob/main/LICENSE`,
                softwareHelp: { '@type': 'CreativeWork', url: brand.docsUrl },
                installUrl: 'https://www.npmjs.com/package/create-payload-stack',
                offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
                publisher: { '@id': ORGANIZATION_ID },
              },
              organizationLd(),
            ],
          }}
        />
        {/* Family strip above the header; opens only on overscroll past the top. */}
        <FamilyBar current="stack" />
        <ConsentRoot>{children}</ConsentRoot>
      </body>
    </html>
  )
}
