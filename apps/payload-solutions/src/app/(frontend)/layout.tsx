import type { Metadata, Viewport } from 'next'
import { RootProvider } from 'fumadocs-ui/provider/next'
import { GeistMono } from 'geist/font/mono'
import { GeistSans } from 'geist/font/sans'
import type { ReactNode } from 'react'
import { brands } from '@payload-solutions/brand'
import { CLIP_CDN } from '@payload-solutions/brand/clips'
import { FamilyBar } from '@payload-solutions/brand/family-bar'
import { ConsentRoot } from '@/components/consent/consent-root'
import './globals.css'

const brand = brands.solutions

export const metadata: Metadata = {
  // Always the apex host, never NEXT_PUBLIC_SITE_URL: canonicals, og:url and OG images must name
  // the one host Google should index (www.payload.solutions redirects to it), on every deploy.
  metadataBase: new URL(brand.url),
  title: {
    default: `${brand.name}: ${brand.tagline}`,
    template: `%s | ${brand.name}`,
  },
  description: brand.description,
  applicationName: brand.name,
  keywords: ['Payload CMS', 'Payload plugins', 'Payload SaaS', 'Payload Stack', 'Payload agency', 'Better Auth Payload'],
  openGraph: { type: 'website', siteName: brand.name, title: brand.tagline, description: brand.description, url: brand.url },
  twitter: { card: 'summary_large_image', title: brand.tagline, description: brand.description },
  robots: { index: true, follow: true },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // The site opens dark whatever the system says, so the browser chrome matches.
  themeColor: '#000000',
}

export default function FrontendLayout({ children }: { children: ReactNode }) {
  return (
    /* data-brand sets the umbrella accent (cobalt); product cards override it per entity. */
    <html
      lang="en"
      data-brand="solutions"
      /* Next disables CSS smooth scrolling during route changes unless this is set. */
      data-scroll-behavior="smooth"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <body className="flex min-h-dvh flex-col bg-bg text-fg antialiased">
        {/* Docs videos stream from here; React hoists this into <head>. */}
        <link rel="preconnect" href={CLIP_CDN} />
        {/* Family strip above the header; opens only on overscroll past the top. */}
        <FamilyBar current="solutions" />
        <RootProvider
          theme={{
            // Brand tokens read data-theme; Fumadocs reads the .dark class. Set both.
            attribute: ['class', 'data-theme'],
            // Dark is the design's home key: it is the default, not the system preference.
            defaultTheme: 'dark',
            enableSystem: false,
            disableTransitionOnChange: true,
          }}
          search={{ options: { api: '/api/search' } }}
        >
          <ConsentRoot>{children}</ConsentRoot>
        </RootProvider>
      </body>
    </html>
  )
}
