import type { Metadata, Viewport } from 'next'
import { GeistMono } from 'geist/font/mono'
import { GeistSans } from 'geist/font/sans'
import type { ReactNode } from 'react'

import { Providers } from '@/components/providers'
import { billingReady } from '@/lib/env'
import stack from '@/stack.config'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL(stack.url),
  title: {
    default: `${stack.name}: ${stack.tagline}`,
    template: `%s | ${stack.name}`,
  },
  description: stack.description,
  applicationName: stack.name,
  openGraph: {
    type: 'website',
    siteName: stack.name,
    title: stack.tagline,
    description: stack.description,
    url: stack.url,
  },
  twitter: {
    card: 'summary_large_image',
    title: stack.tagline,
    description: stack.description,
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
}

export default function FrontendLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <body className="min-h-dvh font-sans">
        <Providers billingReady={billingReady}>{children}</Providers>
      </body>
    </html>
  )
}
