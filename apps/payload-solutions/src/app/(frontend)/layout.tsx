import type { Metadata, Viewport } from 'next'
import { RootProvider } from 'fumadocs-ui/provider/next'
import { GeistMono } from 'geist/font/mono'
import { GeistSans } from 'geist/font/sans'
import type { ReactNode } from 'react'
import { brands } from '@payload-solutions/brand'
import './globals.css'

const brand = brands.solutions

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? brand.url),
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
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#000000' },
  ],
}

export default function FrontendLayout({ children }: { children: ReactNode }) {
  return (
    /* data-brand sets the umbrella accent (cobalt); product cards override it per entity. */
    <html
      lang="en"
      data-brand="solutions"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <body className="flex min-h-dvh flex-col bg-bg text-fg antialiased">
        <RootProvider
          theme={{
            // Brand tokens read data-theme; Fumadocs reads the .dark class. Set both.
            attribute: ['class', 'data-theme'],
            defaultTheme: 'system',
            enableSystem: true,
            disableTransitionOnChange: true,
          }}
          search={{ options: { api: '/api/search' } }}
        >
          {children}
        </RootProvider>
      </body>
    </html>
  )
}
